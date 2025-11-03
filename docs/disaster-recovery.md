# Disaster Recovery Plan

This document outlines the disaster recovery procedures for LexyHub to ensure business continuity in case of system failures, data loss, or other critical incidents.

## Table of Contents

1. [Overview](#overview)
2. [Recovery Objectives](#recovery-objectives)
3. [Backup Strategy](#backup-strategy)
4. [Recovery Procedures](#recovery-procedures)
5. [Incident Response](#incident-response)
6. [Testing and Validation](#testing-and-validation)
7. [Contact Information](#contact-information)

## Overview

### Disaster Scenarios

This plan covers the following disaster scenarios:

- **Database Failure**: PostgreSQL/Supabase database unavailable or corrupted
- **Application Failure**: Next.js application crashes or becomes unresponsive
- **Data Loss**: Accidental deletion or corruption of critical data
- **Security Breach**: Unauthorized access or data breach
- **Infrastructure Failure**: Vercel or Supabase platform issues
- **Dependency Failure**: Third-party service outages (OpenAI, Redis, etc.)

## Recovery Objectives

### Recovery Time Objective (RTO)

Maximum acceptable downtime for each component:

- **Critical Services** (API, Auth): 15 minutes
- **User-facing Application**: 30 minutes
- **Background Jobs**: 2 hours
- **Analytics/Reporting**: 24 hours

### Recovery Point Objective (RPO)

Maximum acceptable data loss:

- **User Data**: 1 hour (hourly backups)
- **Transaction Data**: 5 minutes (real-time replication)
- **Analytics Data**: 24 hours
- **Logs**: 1 hour

## Backup Strategy

### Automated Backups

#### Database Backups

- **Frequency**: Every 6 hours
- **Retention**: 30 days
- **Location**: Supabase automatic backups + custom backups to cloud storage
- **Verification**: Daily automated restore test

**Schedule:**
```bash
# Automated via cron or GitHub Actions
0 */6 * * * npm run backup:create
0 2 * * * npm run backup:clean 30
```

#### Application Configuration

- **Frequency**: On every deployment
- **Location**: Git repository + environment variable backups
- **Items Backed Up**:
  - Environment variables (encrypted)
  - Feature flags configuration
  - API keys and secrets (in secure vault)

#### File Storage Backups

- **Frequency**: Daily
- **Location**: Vercel Blob Storage (automatic versioning)
- **Retention**: 90 days

### Manual Backup Procedures

#### Creating a Manual Backup

```bash
# Full database backup
npm run backup:create

# Schema-only backup
npm run backup:schema

# List available backups
npm run backup:list
```

#### Downloading Backups

1. Access Supabase Dashboard
2. Navigate to Database → Backups
3. Select backup and click "Download"
4. Store in secure location (encrypted storage)

## Recovery Procedures

### Database Recovery

#### Scenario 1: Recent Data Corruption (< 1 hour)

1. **Identify Issue**
   ```bash
   # Check database status
   npm run db:status
   ```

2. **Restore from Latest Backup**
   ```bash
   # Validate backup first
   npm run restore:db validate backup-YYYY-MM-DDTHH-mm-ss-sssZ.json

   # Dry run
   npm run restore:db dry-run backup-YYYY-MM-DDTHH-mm-ss-sssZ.json

   # Restore (merge with existing data)
   npm run restore:db restore backup-YYYY-MM-DDTHH-mm-ss-sssZ.json
   ```

3. **Verify Data Integrity**
   ```bash
   # Run data quality checks
   npm run data-quality:check
   ```

4. **Notify Team**
   - Post incident report
   - Document recovery process
   - Update monitoring

**Estimated Recovery Time**: 15-30 minutes

#### Scenario 2: Complete Database Loss

1. **Provision New Database**
   - Create new Supabase project
   - Update connection strings in environment variables

2. **Run Migrations**
   ```bash
   npm run supabase:migrate
   ```

3. **Restore from Backup**
   ```bash
   npm run restore:db restore-clear backup-YYYY-MM-DDTHH-mm-ss-sssZ.json
   ```

4. **Verify and Test**
   - Run integration tests
   - Verify critical workflows
   - Check data integrity

5. **Update DNS/Routing**
   - Point application to new database
   - Update environment variables
   - Deploy application

**Estimated Recovery Time**: 2-4 hours

### Application Recovery

#### Scenario: Application Deployment Failure

1. **Rollback Deployment**
   ```bash
   # Via Vercel CLI
   vercel rollback

   # Or via Vercel Dashboard
   # Select previous deployment and promote
   ```

2. **Identify Issue**
   - Check build logs
   - Review error reports in Sentry
   - Check monitoring dashboards

3. **Fix and Redeploy**
   ```bash
   # Fix issue locally
   npm run build
   npm test

   # Deploy
   git commit -m "fix: resolve deployment issue"
   git push
   ```

**Estimated Recovery Time**: 10-15 minutes

#### Scenario: Complete Infrastructure Failure

1. **Deploy to Alternative Platform**
   - Export code from Git repository
   - Deploy to backup hosting (e.g., Railway, Fly.io)
   - Update DNS records

2. **Restore Services**
   - Database: Point to Supabase backup
   - Storage: Configure alternative storage
   - Caching: Deploy Redis instance

3. **Verify Functionality**
   - Run smoke tests
   - Check critical user flows
   - Monitor error rates

**Estimated Recovery Time**: 4-8 hours

### Data Recovery

#### Scenario: Accidental Data Deletion

1. **Identify Scope**
   - Determine what data was deleted
   - Check when deletion occurred
   - Identify affected users

2. **Find Appropriate Backup**
   ```bash
   # List backups from before deletion
   npm run backup:list
   ```

3. **Selective Restore**
   ```typescript
   // Restore specific table(s)
   npm run restore:db restore backup-file.json -- --tables=keywords,watchlists
   ```

4. **Verify and Communicate**
   - Verify restored data
   - Notify affected users
   - Document incident

**Estimated Recovery Time**: 30 minutes - 2 hours

## Incident Response

### Severity Levels

#### P0 - Critical (15 min response time)
- Complete system outage
- Data breach or security incident
- Database corruption affecting all users

#### P1 - High (1 hour response time)
- Major feature unavailable
- Performance degradation affecting >50% users
- Background jobs failing

#### P2 - Medium (4 hour response time)
- Non-critical feature unavailable
- Performance issues affecting <10% users
- Monitoring alerts

#### P3 - Low (Next business day)
- Minor bugs
- Feature requests
- Documentation updates

### Incident Response Process

1. **Detection**
   - Automated monitoring alerts
   - User reports
   - Team member observation

2. **Assessment**
   - Determine severity level
   - Identify affected systems
   - Estimate impact

3. **Response**
   - Assemble incident response team
   - Communicate status
   - Begin recovery procedures

4. **Resolution**
   - Implement fix or recovery
   - Verify system functionality
   - Monitor for issues

5. **Post-Incident**
   - Write incident report
   - Conduct retrospective
   - Update procedures
   - Implement prevention measures

### Communication Templates

#### Internal Alert
```
🚨 INCIDENT ALERT

Severity: [P0/P1/P2/P3]
Status: Investigating/Mitigating/Resolved
Impact: [Description]
ETA: [Time to resolution]
Lead: [Name]

Updates: [Link to status page]
```

#### User Communication
```
We're currently experiencing [issue description].
Our team is working to resolve this as quickly as possible.

Status: [Current status]
Expected Resolution: [ETA]
Affected Features: [List]

We'll update this page every [frequency] with progress.
```

## Testing and Validation

### Disaster Recovery Drills

#### Monthly Backup Restore Test

```bash
# Automated test
npm run test:disaster-recovery
```

Test procedure:
1. Select random backup from last 7 days
2. Restore to test database
3. Run data quality checks
4. Verify critical data integrity
5. Document results

#### Quarterly Full DR Exercise

1. Simulate complete system failure
2. Execute recovery procedures
3. Time each step
4. Document issues and improvements
5. Update DR plan

### Backup Validation

#### Daily Automated Checks

```bash
# Validate latest backup
npm run backup:validate latest

# Check backup integrity
npm run backup:integrity-check
```

#### Weekly Manual Verification

1. Download latest backup
2. Restore to local environment
3. Run application tests
4. Verify data completeness
5. Check for corruption

## Contact Information

### Emergency Contacts

**Primary On-Call Engineer**
- Name: [Name]
- Phone: [Phone]
- Email: [Email]

**Backup On-Call Engineer**
- Name: [Name]
- Phone: [Phone]
- Email: [Email]

**Database Administrator**
- Name: [Name]
- Phone: [Phone]
- Email: [Email]

### Service Providers

**Vercel Support**
- Support: https://vercel.com/support
- Status: https://vercel-status.com

**Supabase Support**
- Support: https://supabase.com/dashboard/support
- Status: https://status.supabase.com

**Sentry Support**
- Support: https://sentry.io/support
- Status: https://status.sentry.io

### Escalation Path

1. On-Call Engineer (Response: 15 min)
2. Team Lead (Response: 30 min)
3. CTO (Response: 1 hour)
4. CEO (Response: 2 hours)

## Appendices

### Checklist: Database Recovery

- [ ] Identify issue and scope
- [ ] Notify team and start incident response
- [ ] Validate available backups
- [ ] Run dry-run restore
- [ ] Execute restore procedure
- [ ] Verify data integrity
- [ ] Run smoke tests
- [ ] Monitor system health
- [ ] Document recovery process
- [ ] Conduct post-incident review

### Checklist: Application Deployment Rollback

- [ ] Identify failed deployment
- [ ] Access Vercel dashboard
- [ ] Select previous working deployment
- [ ] Promote previous deployment
- [ ] Verify application functionality
- [ ] Check error monitoring
- [ ] Investigate root cause
- [ ] Fix and redeploy
- [ ] Document incident

### Useful Commands

```bash
# Database
npm run backup:create          # Create database backup
npm run backup:list            # List available backups
npm run restore:db validate    # Validate backup file
npm run restore:db dry-run     # Test restore
npm run restore:db restore     # Restore from backup

# Application
npm run build                  # Build application
npm run test                   # Run tests
npm run test:e2e              # Run E2E tests

# Monitoring
npm run health-check          # Check system health
npm run db:status             # Check database status
```

---

**Document Version**: 1.0
**Last Updated**: [Date]
**Next Review**: [Date + 90 days]
**Owner**: DevOps Team
