interface AwsErrorMessageProps {
  error: string;
  status?: number;
}

// Explains the AWS failures we already know about (see docs/architecture/aws-integration.md)
// instead of only showing AWS's raw error text.
function AwsErrorMessage({ error, status }: AwsErrorMessageProps) {
  let hint: string | null = null;
  if (status === 401) {
    hint = "Sign in (top right) to view AWS resources.";
  } else if (/service control policy/i.test(error)) {
    hint =
      "AWS blocked this call for the whole account. AWS Free plan accounts don't allow listing EC2 " +
      "through the API (the console still works). Use an account that allows programmatic EC2 access.";
  } else if (/not authorized|AccessDenied|UnauthorizedOperation/i.test(error)) {
    hint = "The CloudOps Hub IAM user is missing a permission. Check the CloudOpsHubReadOnly policy.";
  } else if (/credentials|NoCredentials|Unable to locate/i.test(error)) {
    hint = "The backend has no AWS credentials. Set AWS_PROFILE before starting it (see backend README).";
  } else if (status === 502) {
    hint = "The backend reached AWS, but AWS returned an error.";
  }

  return (
    <div className="notice warn" role="alert">
      {hint && <p className="notice-title">{hint}</p>}
      <p className="notice-detail">{error}</p>
    </div>
  );
}

export default AwsErrorMessage;
