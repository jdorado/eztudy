# Data handling

Eztudy is self-hosted software. The operator, not this source repository, controls
the deployment and its data.

The API stores Privy subject identifiers, server-created account and tenant IDs,
published Programs and prior revisions, chat requests and replies, attachment
bytes, Ez run references, and publication credential digests in MongoDB. It does
not store the Privy bearer token or plaintext publication credentials. Ez stores
its own runtime, native-session, and delivery state outside this repository.

The 0.1 release has no automatic retention, account export, or account deletion
workflow. Data remains until the operator removes it from MongoDB and the related
Ez installation, including backups according to the operator's retention policy.
Operators should disclose their policy to users, restrict database and backup
access, and test restoration and deletion procedures before inviting users.

Registration is restricted to configured Privy subjects. The API
refuses to start with more than one canonical account because multi-tenant
production isolation is not yet accepted. Chat attachments are limited per
request, but the release has no storage quota.
