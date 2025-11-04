# 🔒 SECURITY NOTICE - IMPORTANT

## Critical Security Issue Found

During the code review, I discovered that sensitive files are committed to the git repository:

- ✅ `.env` - Contains Pinata API keys
- ✅ `service_wallet.json` - Contains Solana wallet private key

## Immediate Actions Required

### 1. Rotate All Credentials

The following credentials have been exposed in the git history and should be rotated immediately:

#### Pinata API Keys
- Current keys in `.env` are exposed
- Generate new API keys at: https://app.pinata.cloud/keys
- Update `.env` with new keys

#### Service Wallet
- Current wallet private key is exposed
- Generate a new wallet:
  ```bash
  solana-keygen new --outfile service_wallet.json
  ```
- Update the wallet address in all documentation
- Transfer any assets from the old wallet to the new one

### 2. Remove Sensitive Files from Git History

**WARNING:** This will rewrite git history. Coordinate with all team members before proceeding.

```bash
# Remove .env from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Remove service_wallet.json from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch service_wallet.json' \
  --prune-empty --tag-name-filter cat -- --all

# Force push to remote (WARNING: destructive operation)
git push origin --force --all
```

**Alternative (recommended):** Use BFG Repo-Cleaner:
```bash
# Install BFG
brew install bfg  # macOS
# or download from: https://rtyley.github.io/bfg-repo-cleaner/

# Remove sensitive files
bfg --delete-files .env
bfg --delete-files service_wallet.json

# Clean up and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

### 3. Verify Cleanup

After removing files from history:
```bash
# Verify files are not in history
git log --all --full-history -- .env
git log --all --full-history -- service_wallet.json

# Should return no results
```

### 4. Update .gitignore

✅ Already updated `.gitignore` to prevent future commits:
```
.env
.env.local
.env.*.local
service_wallet.json
```

### 5. Create Template Files

Create example files without sensitive data:

**.env.example:**
```bash
# Solana Configuration
SOLANA_CLUSTER_URL="https://api.devnet.solana.com"

# Service wallet secret key (Base58 encoded)
# Generate with: solana-keygen new
SERVICE_SECRET_KEY_BASE58=YOUR_SECRET_KEY_HERE
SERVICE_SECRET_KEY=YOUR_SECRET_KEY_HERE

# Pinata IPFS Configuration
# Get your keys from: https://app.pinata.cloud/keys
PINATA_API_KEY=your_api_key_here
PINATA_SECRET_API_KEY=your_secret_key_here

# Server Configuration
PORT=3000
```

**service_wallet.json.example:**
```json
[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
```

## Security Best Practices

### Environment Variables
- ✅ Never commit `.env` files
- ✅ Use `.env.example` for templates
- ✅ Document required variables
- ✅ Use environment-specific files (.env.development, .env.production)

### Private Keys
- ✅ Never commit private keys or seed phrases
- ✅ Use hardware wallets for production
- ✅ Use different wallets for dev/test/prod
- ✅ Store securely (password managers, vaults)

### API Keys
- ✅ Rotate regularly
- ✅ Use different keys for different environments
- ✅ Set IP restrictions when possible
- ✅ Monitor usage for anomalies

### CI/CD
- ✅ Use secret management (GitHub Secrets, etc.)
- ✅ Never log sensitive information
- ✅ Mask secrets in logs
- ✅ Use short-lived credentials when possible

## Next Steps

1. ✅ Immediately rotate all exposed credentials
2. ✅ Remove sensitive files from git history
3. ✅ Update documentation with new wallet address
4. ✅ Create .env.example and service_wallet.json.example
5. ✅ Educate team on security best practices
6. ✅ Set up automated secret scanning (e.g., git-secrets, gitleaks)

## Automated Secret Scanning

Consider setting up pre-commit hooks:

```bash
# Install git-secrets
brew install git-secrets  # macOS

# Set up for repository
cd /path/to/repo
git secrets --install
git secrets --register-aws
git secrets --add 'PINATA_API_KEY'
git secrets --add 'SERVICE_SECRET_KEY'
```

Or use GitHub's secret scanning feature (enabled automatically for public repos).

## References

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-secrets](https://github.com/awslabs/git-secrets)
- [Solana Key Management](https://docs.solana.com/cli/conventions#keypair-conventions)

---

**Status:** ⚠️ URGENT - Credentials exposed in git history  
**Priority:** CRITICAL  
**Action Required:** Immediate credential rotation and history cleanup
