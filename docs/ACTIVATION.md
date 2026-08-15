# Activation and Key Requests

EzMindSphere requires a valid activation key before authentication and classroom APIs become available.

## Activate

1. Open the platform URL.
2. Enter the educational institution name.
3. Enter an institutional contact email.
4. Paste the activation key exactly as supplied.
5. Select **Activate Platform**.

Activation is stored in the persistent `data/license-activation.json` volume. Do not commit this file.

## Request a key

Email **eozoe2025@gmail.com** with the subject `EzMindSphere Educational Activation Key Request` and include:

- institution legal name;
- institution type and country;
- administrator name and institutional email;
- intended deployment hostname or campus;
- approximate number of educators and students;
- confirmation that the deployment is for educational, non-resale use.

## Key security

Treat activation keys as confidential. Do not post them in issues, screenshots, videos, or public repositories. The repository contains only SHA-256 key hashes. Contact Ejoe Tso if a key must be replaced.
