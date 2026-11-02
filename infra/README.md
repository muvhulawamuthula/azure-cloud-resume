# Infrastructure (AWS CDK, Java)

This folder is the AWS CDK app for the cloud resume. For the architecture, the stacks and the
first-time setup, see the [main README](../README.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `mvn test` | Run the CDK assertion tests |
| `cdk ls` | List the stacks |
| `cdk synth --strict` | Synthesize the CloudFormation templates, failing on warnings |
| `cdk diff` | Compare the deployed stacks with the code |
| `cdk deploy ResumeCertStack ResumeSiteStack` | Deploy the certificate and the site |

## Configuration

Context values, set in `cdk.json` or with `-c key=value`:

| Key | Default | Meaning |
| --- | --- | --- |
| `domain` | *(unset)* | Root domain for CloudFront. When unset, the site is served only on `*.cloudfront.net` and no certificate stack is created. |
| `resumeRepo` | `..` | Path to the folder that contains `frontend/` and `lambda/src/` |

The stacks deploy to the account and region of the active AWS CLI profile. The certificate
stack always goes to `us-east-1`.
