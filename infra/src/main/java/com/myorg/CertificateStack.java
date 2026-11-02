package com.myorg;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.certificatemanager.Certificate;
import software.amazon.awscdk.services.certificatemanager.CertificateValidation;
import software.amazon.awscdk.services.certificatemanager.ICertificate;
import software.constructs.Construct;

import java.util.List;

/**
 * ACM certificate for the root domain and www, in us-east-1.
 *
 * DNS lives on Cloudflare, so validation is manual: while this stack is
 * deploying, the validation CNAME(s) must be added in Cloudflare (DNS only,
 * grey cloud). The deploy waits until ACM sees them.
 */
public class CertificateStack extends Stack {
    private final ICertificate certificate;

    public CertificateStack(final Construct scope, final String id, final StackProps props, final String domain) {
        super(scope, id, props);

        Certificate cert = Certificate.Builder.create(this, "SiteCertificate")
                .domainName(domain)
                .subjectAlternativeNames(List.of("www." + domain))
                .validation(CertificateValidation.fromDns())
                .certificateName("cloud-resume-" + domain)
                .build();
        this.certificate = cert;

        CfnOutput.Builder.create(this, "CertificateArn").value(cert.getCertificateArn()).build();
    }

    public ICertificate getCertificate() {
        return certificate;
    }
}
