package com.myorg;

import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.assertions.Match;
import software.amazon.awscdk.assertions.Template;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

class ResumeSiteStackTest {

    private static final Path REPO = Path.of("..").toAbsolutePath().normalize();
    private static final Environment ENV = Environment.builder().account("111111111111").region("eu-west-1").build();

    private Template synthNoDomain() {
        App app = new App();
        ResumeSiteStack stack = new ResumeSiteStack(app, "Test", StackProps.builder().env(ENV).build(),
                new ResumeSiteStack.Config(null, null, REPO));
        return Template.fromStack(stack);
    }

    @Test
    void bucketIsPrivateAndEncrypted() {
        synthNoDomain().hasResourceProperties("AWS::S3::Bucket", Map.of(
                "PublicAccessBlockConfiguration", Map.of(
                        "BlockPublicAcls", true, "BlockPublicPolicy", true,
                        "IgnorePublicAcls", true, "RestrictPublicBuckets", true)));
    }

    @Test
    void cloudFrontUsesOacAndRoutesApi() {
        Template t = synthNoDomain();
        t.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
        t.hasResourceProperties("AWS::CloudFront::Distribution", Map.of(
                "DistributionConfig", Match.objectLike(Map.of(
                        "DefaultRootObject", "index.html",
                        "CacheBehaviors", List.of(Match.objectLike(Map.of(
                                "PathPattern", "/api/*",
                                "ViewerProtocolPolicy", "https-only")))))));
    }

    @Test
    void lambdaCanOnlyUpdateItem() {
        Template t = synthNoDomain();
        t.hasResourceProperties("AWS::Lambda::Function", Map.of(
                "Runtime", "nodejs22.x",
                "Architectures", List.of("arm64"),
                "Handler", "visitorCounter.handler"));
        t.hasResourceProperties("AWS::IAM::Policy", Map.of(
                "PolicyDocument", Map.of("Statement", List.of(Match.objectLike(Map.of(
                        "Action", "dynamodb:UpdateItem",
                        "Effect", "Allow"))),
                        "Version", "2012-10-17")));
    }

    @Test
    void counterTableIsRetained() {
        synthNoDomain().hasResource("AWS::DynamoDB::GlobalTable", Map.of(
                "DeletionPolicy", "Retain"));
    }

    @Test
    void customDomainAddsAliasesAndRedirect() {
        App app = new App();
        CertificateStack cert = new CertificateStack(app, "Cert", StackProps.builder()
                .env(Environment.builder().account("111111111111").region("us-east-1").build())
                .crossRegionReferences(true).build(), "example.com");
        ResumeSiteStack site = new ResumeSiteStack(app, "Site", StackProps.builder().env(ENV)
                .crossRegionReferences(true).build(),
                new ResumeSiteStack.Config("example.com", cert.getCertificate(), REPO));

        Template.fromStack(cert).hasResourceProperties("AWS::CertificateManager::Certificate", Map.of(
                "DomainName", "example.com",
                "SubjectAlternativeNames", List.of("www.example.com"),
                "ValidationMethod", "DNS"));
        Template t = Template.fromStack(site);
        t.hasResourceProperties("AWS::CloudFront::Distribution", Map.of(
                "DistributionConfig", Match.objectLike(Map.of(
                        "Aliases", List.of("example.com", "www.example.com")))));
        t.resourceCountIs("AWS::CloudFront::Function", 1);
    }
}
