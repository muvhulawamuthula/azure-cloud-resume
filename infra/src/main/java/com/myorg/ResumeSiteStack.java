package com.myorg;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.apigatewayv2.HttpApi;
import software.amazon.awscdk.services.apigatewayv2.HttpMethod;
import software.amazon.awscdk.services.apigatewayv2.HttpStageOptions;
import software.amazon.awscdk.services.apigatewayv2.ThrottleSettings;
import software.amazon.awscdk.services.apigatewayv2.AddRoutesOptions;
import software.amazon.awscdk.aws_apigatewayv2_integrations.HttpLambdaIntegration;
import software.amazon.awscdk.services.certificatemanager.ICertificate;
import software.amazon.awscdk.services.cloudfront.AllowedMethods;
import software.amazon.awscdk.services.cloudfront.BehaviorOptions;
import software.amazon.awscdk.services.cloudfront.CachePolicy;
import software.amazon.awscdk.services.cloudfront.Distribution;
import software.amazon.awscdk.services.cloudfront.ErrorResponse;
import software.amazon.awscdk.services.cloudfront.Function;
import software.amazon.awscdk.services.cloudfront.FunctionCode;
import software.amazon.awscdk.services.cloudfront.FunctionEventType;
import software.amazon.awscdk.services.cloudfront.FunctionAssociation;
import software.amazon.awscdk.services.cloudfront.FunctionRuntime;
import software.amazon.awscdk.services.cloudfront.HeadersFrameOption;
import software.amazon.awscdk.services.cloudfront.HeadersReferrerPolicy;
import software.amazon.awscdk.services.cloudfront.OriginRequestPolicy;
import software.amazon.awscdk.services.cloudfront.PriceClass;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersContentTypeOptions;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersFrameOptions;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersPolicy;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersReferrerPolicy;
import software.amazon.awscdk.services.cloudfront.ResponseHeadersStrictTransportSecurity;
import software.amazon.awscdk.services.cloudfront.ResponseSecurityHeadersBehavior;
import software.amazon.awscdk.services.cloudfront.ViewerProtocolPolicy;
import software.amazon.awscdk.services.cloudfront.origins.HttpOrigin;
import software.amazon.awscdk.services.cloudfront.origins.S3BucketOrigin;
import software.amazon.awscdk.services.dynamodb.Attribute;
import software.amazon.awscdk.services.dynamodb.AttributeType;
import software.amazon.awscdk.services.dynamodb.Billing;
import software.amazon.awscdk.services.dynamodb.PointInTimeRecoverySpecification;
import software.amazon.awscdk.services.dynamodb.TableV2;
import software.amazon.awscdk.services.lambda.Architecture;
import software.amazon.awscdk.services.lambda.Code;
import software.amazon.awscdk.services.lambda.Runtime;
import software.amazon.awscdk.services.logs.LogGroup;
import software.amazon.awscdk.services.logs.RetentionDays;
import software.amazon.awscdk.services.s3.BlockPublicAccess;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.BucketEncryption;
import software.amazon.awscdk.services.s3.deployment.BucketDeployment;
import software.amazon.awscdk.services.s3.deployment.Source;
import software.constructs.Construct;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Static resume site plus visitor counter, served same-origin through CloudFront:
 *
 *   /*      -> private S3 bucket (Origin Access Control)
 *   /api/*  -> HTTP API -> Lambda -> DynamoDB (atomic ADD)
 */
public class ResumeSiteStack extends Stack {

    /** domain and certificate are both null when serving only on *.cloudfront.net. */
    public record Config(String domain, ICertificate certificate, Path resumeRepo) {}

    public ResumeSiteStack(final Construct scope, final String id, final StackProps props, final Config cfg) {
        super(scope, id, props);

        Path frontendDir = requireDir(cfg.resumeRepo().resolve("frontend"));
        Path lambdaDir = requireDir(cfg.resumeRepo().resolve("lambda/src"));

        // ---- Visitor counter API -------------------------------------------------

        TableV2 table = TableV2.Builder.create(this, "VisitorCounterTable")
                .partitionKey(Attribute.builder().name("pk").type(AttributeType.STRING).build())
                .billing(Billing.onDemand())
                .pointInTimeRecoverySpecification(PointInTimeRecoverySpecification.builder()
                        .pointInTimeRecoveryEnabled(true).build())
                .removalPolicy(RemovalPolicy.RETAIN) // the count is the only state worth keeping
                .build();

        LogGroup fnLogs = LogGroup.Builder.create(this, "VisitorCounterLogs")
                .retention(RetentionDays.ONE_MONTH)
                .removalPolicy(RemovalPolicy.DESTROY)
                .build();

        software.amazon.awscdk.services.lambda.Function counterFn =
                software.amazon.awscdk.services.lambda.Function.Builder.create(this, "VisitorCounterFn")
                        .description("Cloud resume visitor counter (atomic DynamoDB ADD)")
                        .runtime(Runtime.NODEJS_22_X)
                        .architecture(Architecture.ARM_64)
                        .handler("visitorCounter.handler")
                        .code(Code.fromAsset(lambdaDir.toString()))
                        .memorySize(128)
                        .timeout(Duration.seconds(5))
                        .environment(Map.of("TABLE_NAME", table.getTableName()))
                        .logGroup(fnLogs)
                        .build();
        // Least privilege: the function can only increment items in this table.
        table.grant(counterFn, "dynamodb:UpdateItem");

        HttpApi api = HttpApi.Builder.create(this, "VisitorCounterApi")
                .description("Cloud resume visitor counter")
                .createDefaultStage(false)
                .build();
        api.addStage("DefaultStage", HttpStageOptions.builder()
                .stageName("$default")
                .autoDeploy(true)
                .throttle(ThrottleSettings.builder().rateLimit(10).burstLimit(20).build())
                .build());
        api.addRoutes(AddRoutesOptions.builder()
                .path("/api/visitorCounter")
                .methods(List.of(HttpMethod.GET))
                .integration(new HttpLambdaIntegration("CounterIntegration", counterFn))
                .build());

        // ---- Static site ---------------------------------------------------------

        Bucket siteBucket = Bucket.Builder.create(this, "SiteBucket")
                .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
                .encryption(BucketEncryption.S3_MANAGED)
                .enforceSsl(true)
                // Contents come from git and are re-uploaded on every deploy.
                .removalPolicy(RemovalPolicy.DESTROY)
                .autoDeleteObjects(true)
                .build();

        // Same headers the Azure Static Web App sent, plus HSTS.
        ResponseHeadersPolicy securityHeaders = ResponseHeadersPolicy.Builder.create(this, "SecurityHeaders")
                .securityHeadersBehavior(ResponseSecurityHeadersBehavior.builder()
                        .frameOptions(ResponseHeadersFrameOptions.builder()
                                .frameOption(HeadersFrameOption.DENY).override(true).build())
                        .contentTypeOptions(ResponseHeadersContentTypeOptions.builder().override(true).build())
                        .referrerPolicy(ResponseHeadersReferrerPolicy.builder()
                                .referrerPolicy(HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                                .override(true).build())
                        .strictTransportSecurity(ResponseHeadersStrictTransportSecurity.builder()
                                .accessControlMaxAge(Duration.days(365))
                                .includeSubdomains(true)
                                .override(true).build())
                        .build())
                .build();

        BehaviorOptions.Builder siteBehavior = BehaviorOptions.builder()
                .origin(S3BucketOrigin.withOriginAccessControl(siteBucket))
                .viewerProtocolPolicy(ViewerProtocolPolicy.REDIRECT_TO_HTTPS)
                .cachePolicy(CachePolicy.CACHING_OPTIMIZED)
                .responseHeadersPolicy(securityHeaders)
                .compress(true);

        Distribution.Builder dist = Distribution.Builder.create(this, "SiteDistribution")
                .comment("Cloud resume" + (cfg.domain() != null ? " - " + cfg.domain() : ""))
                .defaultRootObject("index.html")
                .priceClass(PriceClass.PRICE_CLASS_ALL) // includes the Johannesburg / Cape Town edges
                .additionalBehaviors(Map.of("/api/*", BehaviorOptions.builder()
                        .origin(new HttpOrigin(api.getApiId() + ".execute-api." + getRegion() + ".amazonaws.com"))
                        .viewerProtocolPolicy(ViewerProtocolPolicy.HTTPS_ONLY)
                        .allowedMethods(AllowedMethods.ALLOW_GET_HEAD_OPTIONS)
                        .cachePolicy(CachePolicy.CACHING_DISABLED)
                        .originRequestPolicy(OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER)
                        .responseHeadersPolicy(securityHeaders)
                        .build()))
                // Private bucket + OAC returns 403 for missing keys; serve index.html like the SWA did.
                .errorResponses(List.of(
                        ErrorResponse.builder().httpStatus(403).responseHttpStatus(200)
                                .responsePagePath("/index.html").ttl(Duration.minutes(5)).build(),
                        ErrorResponse.builder().httpStatus(404).responseHttpStatus(200)
                                .responsePagePath("/index.html").ttl(Duration.minutes(5)).build()));

        if (cfg.domain() != null) {
            Function wwwRedirect = Function.Builder.create(this, "WwwRedirect")
                    .runtime(FunctionRuntime.JS_2_0)
                    .comment("Redirect www." + cfg.domain() + " to the root domain")
                    .code(FunctionCode.fromInline(String.join("\n",
                            "function handler(event) {",
                            "  var req = event.request;",
                            "  var host = req.headers.host && req.headers.host.value;",
                            "  if (host && host.indexOf('www.') === 0) {",
                            "    return { statusCode: 301, statusDescription: 'Moved Permanently',",
                            "      headers: { location: { value: 'https://" + cfg.domain() + "' + req.uri } } };",
                            "  }",
                            "  return req;",
                            "}")))
                    .build();
            siteBehavior.functionAssociations(List.of(FunctionAssociation.builder()
                    .function(wwwRedirect).eventType(FunctionEventType.VIEWER_REQUEST).build()));
            dist.domainNames(List.of(cfg.domain(), "www." + cfg.domain()))
                    .certificate(cfg.certificate());
        }

        Distribution distribution = dist.defaultBehavior(siteBehavior.build()).build();

        BucketDeployment.Builder.create(this, "DeploySite")
                .sources(List.of(Source.asset(frontendDir.toString())))
                .exclude(List.of("staticwebapp.config.json")) // Azure-only file
                .destinationBucket(siteBucket)
                .distribution(distribution)
                .distributionPaths(List.of("/*"))
                .build();

        // ---- Outputs -------------------------------------------------------------

        CfnOutput.Builder.create(this, "CloudFrontDomain")
                .description("Point the Cloudflare CNAME records here (DNS only / grey cloud)")
                .value(distribution.getDistributionDomainName()).build();
        CfnOutput.Builder.create(this, "SiteUrl")
                .value("https://" + (cfg.domain() != null ? cfg.domain() : distribution.getDistributionDomainName()))
                .build();
        CfnOutput.Builder.create(this, "DistributionId").value(distribution.getDistributionId()).build();
        CfnOutput.Builder.create(this, "SiteBucketName").value(siteBucket.getBucketName()).build();
        CfnOutput.Builder.create(this, "CounterTableName").value(table.getTableName()).build();
    }

    private static Path requireDir(Path dir) {
        if (!Files.isDirectory(dir)) {
            throw new IllegalStateException("Expected directory not found: " + dir
                    + " (set -c resumeRepo=<path to the resume repo>)");
        }
        return dir;
    }
}
