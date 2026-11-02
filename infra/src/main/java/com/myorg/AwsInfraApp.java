package com.myorg;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.certificatemanager.ICertificate;

import java.nio.file.Path;

/**
 * Cloud resume on AWS.
 *
 * Context (set in cdk.json or with -c key=value):
 *   domain      root domain served by CloudFront, e.g. example.co.za (DNS on Cloudflare).
 *               Leave unset to serve only on the *.cloudfront.net URL.
 *   resumeRepo  path to the resume repo holding frontend/ and lambda/src/
 *               (default .., i.e. this repo).
 */
public class AwsInfraApp {
    public static void main(final String[] args) {
        App app = new App();

        String account = System.getenv("CDK_DEFAULT_ACCOUNT");
        String region = System.getenv("CDK_DEFAULT_REGION");

        String domain = blankToNull((String) app.getNode().tryGetContext("domain"));
        String resumeRepo = blankToNull((String) app.getNode().tryGetContext("resumeRepo"));
        Path repo = Path.of(resumeRepo != null ? resumeRepo : "..").toAbsolutePath().normalize();

        ICertificate certificate = null;
        if (domain != null) {
            // CloudFront only accepts certificates from us-east-1.
            CertificateStack certStack = new CertificateStack(app, "ResumeCertStack", StackProps.builder()
                    .env(Environment.builder().account(account).region("us-east-1").build())
                    .crossRegionReferences(true)
                    .description("ACM certificate for the cloud resume (" + domain + ")")
                    .build(), domain);
            certificate = certStack.getCertificate();
        }

        new ResumeSiteStack(app, "ResumeSiteStack", StackProps.builder()
                .env(Environment.builder().account(account).region(region).build())
                .crossRegionReferences(true)
                .description("Cloud resume: S3 + CloudFront site and visitor counter API")
                .build(), new ResumeSiteStack.Config(domain, certificate, repo));

        // Deployed once from a workstation; CI cannot create its own trust.
        new GitHubOidcStack(app, "GitHubOidcStack", StackProps.builder()
                .env(Environment.builder().account(account).region(region).build())
                .description("GitHub Actions OIDC deploy role for the cloud resume")
                .build(), "muvhulawamuthula/azure-cloud-resume");

        app.synth();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
