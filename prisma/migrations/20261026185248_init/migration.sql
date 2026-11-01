-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PUBLISHER', 'EDITOR', 'SALES', 'SALES_MANAGER', 'MARKETING');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientPermission" AS ENUM ('NOT_REQUIRED', 'PENDING', 'GRANTED');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'IN_REVIEW', 'QUALIFIED', 'IN_PROGRESS', 'WON', 'LOST', 'NOT_QUALIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD', 'SKIPPED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "mfaSecretEnc" TEXT,
    "mfaEnabledAt" TIMESTAMP(3),
    "mfaLastUsedStep" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSignInAt" TIMESTAMP(3),
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" UUID,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "mfaPending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSetupToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "publishedSlug" TEXT,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "showInFooter" BOOLEAN NOT NULL DEFAULT false,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "authorId" UUID,
    "approverId" UUID,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "publishedSlug" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "authorId" UUID,
    "approverId" UUID,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "publishedSlug" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "thumbnailId" UUID,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientPermission" "ClientPermission" NOT NULL DEFAULT 'NOT_REQUIRED',
    "evidenceApprovedById" UUID,
    "evidenceApprovedAt" TIMESTAMP(3),
    "evidenceNote" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "reviewNote" TEXT,
    "authorId" UUID,
    "approverId" UUID,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectService" (
    "projectId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("projectId","serviceId")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" UUID NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 308,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Enquiry" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "projectSummary" TEXT NOT NULL,
    "timeline" TEXT,
    "budgetRange" TEXT,
    "contactPreference" TEXT NOT NULL DEFAULT 'email',
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" UUID,
    "sourcePath" TEXT,
    "sourceService" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrerHost" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "anonymisedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryServiceInterest" (
    "enquiryId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "serviceLabel" TEXT NOT NULL,

    CONSTRAINT "EnquiryServiceInterest_pkey" PRIMARY KEY ("enquiryId","serviceId")
);

-- CreateTable
CREATE TABLE "EnquiryActivity" (
    "id" UUID NOT NULL,
    "enquiryId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "metadata" JSONB,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "enquiryId" UUID,
    "purpose" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "choice" BOOLEAN NOT NULL,
    "captureSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "enquiryId" UUID,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSetupToken_tokenHash_key" ON "UserSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSetupToken_userId_idx" ON "UserSetupToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Page_publishedSlug_key" ON "Page"("publishedSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_publishedSlug_key" ON "Service"("publishedSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_publishedSlug_key" ON "Project"("publishedSlug");

-- CreateIndex
CREATE INDEX "Project_status_sortDate_idx" ON "Project"("status", "sortDate");

-- CreateIndex
CREATE INDEX "ProjectService_serviceId_idx" ON "ProjectService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_sourcePath_key" ON "Redirect"("sourcePath");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_reference_key" ON "Enquiry"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Enquiry_submissionKey_key" ON "Enquiry"("submissionKey");

-- CreateIndex
CREATE INDEX "Enquiry_status_createdAt_idx" ON "Enquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_assignedToId_idx" ON "Enquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "Enquiry_createdAt_idx" ON "Enquiry"("createdAt");

-- CreateIndex
CREATE INDEX "Enquiry_emailNormalized_idx" ON "Enquiry"("emailNormalized");

-- CreateIndex
CREATE INDEX "EnquiryServiceInterest_serviceId_idx" ON "EnquiryServiceInterest"("serviceId");

-- CreateIndex
CREATE INDEX "EnquiryActivity_enquiryId_createdAt_idx" ON "EnquiryActivity"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_enquiryId_idx" ON "ConsentRecord"("enquiryId");

-- CreateIndex
CREATE INDEX "Notification_status_nextAttemptAt_idx" ON "Notification"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Notification_enquiryId_idx" ON "Notification"("enquiryId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSetupToken" ADD CONSTRAINT "UserSetupToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryServiceInterest" ADD CONSTRAINT "EnquiryServiceInterest_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryServiceInterest" ADD CONSTRAINT "EnquiryServiceInterest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryActivity" ADD CONSTRAINT "EnquiryActivity_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryActivity" ADD CONSTRAINT "EnquiryActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Database-level integrity constraints (spec 9.3: critical constraints also
-- exist at database level, not only in application code).
-- ---------------------------------------------------------------------------
ALTER TABLE "Page" ADD CONSTRAINT "Page_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Service" ADD CONSTRAINT "Service_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "Project" ADD CONSTRAINT "Project_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Published content must carry a snapshot and a routed slug (BR-01).
ALTER TABLE "Page" ADD CONSTRAINT "Page_published_snapshot" CHECK ("status" <> 'PUBLISHED' OR ("published" IS NOT NULL AND "publishedSlug" IS NOT NULL AND "publishedAt" IS NOT NULL));
ALTER TABLE "Service" ADD CONSTRAINT "Service_published_snapshot" CHECK ("status" <> 'PUBLISHED' OR ("published" IS NOT NULL AND "publishedSlug" IS NOT NULL AND "publishedAt" IS NOT NULL));
ALTER TABLE "Project" ADD CONSTRAINT "Project_published_snapshot" CHECK ("status" <> 'PUBLISHED' OR ("published" IS NOT NULL AND "publishedSlug" IS NOT NULL AND "publishedAt" IS NOT NULL));

-- Identifying client evidence needs a recorded approval before publication (BR-07).
ALTER TABLE "Project" ADD CONSTRAINT "Project_permission_before_publish" CHECK ("status" <> 'PUBLISHED' OR "clientPermission" <> 'PENDING');

ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_no_self_loop" CHECK ("sourcePath" <> "targetPath");
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_paths_absolute" CHECK (left("sourcePath", 1) = '/' AND left("targetPath", 1) = '/');
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_status_code" CHECK ("statusCode" IN (301, 302, 307, 308));

ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_lengths" CHECK (
  char_length("name") BETWEEN 1 AND 120
  AND char_length("email") BETWEEN 3 AND 254
  AND char_length("organisation") BETWEEN 1 AND 160
  AND char_length("projectSummary") BETWEEN 1 AND 5000
);
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_version_positive" CHECK ("version" > 0);
ALTER TABLE "EnquiryActivity" ADD CONSTRAINT "EnquiryActivity_body_length" CHECK ("body" IS NULL OR char_length("body") <= 5000);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_mime" CHECK ("mimeType" IN ('image/webp', 'image/jpeg', 'image/png'));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_attempts" CHECK ("attempts" >= 0);
