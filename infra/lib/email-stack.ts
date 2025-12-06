import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface EmailStackProps extends cdk.StackProps {
  verifiedSenderEmail: string;
}

export class EmailStack extends cdk.Stack {
  public readonly verifiedEmail: string;
  public readonly sesPolicy: iam.PolicyStatement;

  constructor(scope: Construct, id: string, props: EmailStackProps) {
    super(scope, id, props);

    this.verifiedEmail = props.verifiedSenderEmail;

    const emailIdentity = new ses.EmailIdentity(this, 'SenderEmailIdentity', {
      identity: ses.Identity.email(this.verifiedEmail),
    });

    this.sesPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'ses:FromAddress': this.verifiedEmail,
        },
      },
    });

    new cdk.CfnOutput(this, 'VerifiedSenderEmail', {
      value: this.verifiedEmail,
      description: 'Verified SES Sender Email Address',
    });

    new cdk.CfnOutput(this, 'EmailIdentityArn', {
      value: emailIdentity.emailIdentityArn,
      description: 'SES Email Identity ARN',
    });

    new cdk.CfnOutput(this, 'SESVerificationNote', {
      value: 'Please verify the email address in the AWS SES Console',
      description: 'Manual verification required',
    });
  }
}
