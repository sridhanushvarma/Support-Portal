import { PrismaClient, type Prisma } from "@prisma/client";
import { PAGES, SERVICES } from "./seed-content";
import { buildPageSnapshot, buildServiceSnapshot } from "../src/lib/content/snapshots";

/**
 * Idempotent seed. Creates starter services and pages only when their slug does
 * not exist yet, so it never overwrites content edited by the team.
 * Usage: npm run db:seed   (set SEED_PUBLISH=false to create everything as drafts)
 */
const prisma = new PrismaClient();
const publish = process.env.SEED_PUBLISH !== "false";

async function main() {
  const now = new Date();
  let created = 0;

  for (const s of SERVICES) {
    if (await prisma.service.findUnique({ where: { slug: s.slug } })) continue;
    const row = await prisma.service.create({
      data: {
        slug: s.slug,
        name: s.name,
        sortOrder: s.sortOrder,
        seoTitle: s.seoTitle,
        seoDescription: s.seoDescription,
        content: s.content as unknown as Prisma.InputJsonValue,
      },
    });
    if (publish) {
      await prisma.service.update({
        where: { id: row.id },
        data: {
          status: "PUBLISHED",
          publishedSlug: row.slug,
          publishedAt: now,
          lastReviewedAt: now,
          published: buildServiceSnapshot(row) as unknown as Prisma.InputJsonValue,
        },
      });
    }
    created++;
  }

  for (const p of PAGES) {
    if (await prisma.page.findUnique({ where: { slug: p.slug } })) continue;
    const row = await prisma.page.create({
      data: {
        slug: p.slug,
        title: p.title,
        seoTitle: p.seoTitle || null,
        seoDescription: p.seoDescription,
        showInFooter: p.showInFooter,
        content: p.content as unknown as Prisma.InputJsonValue,
      },
    });
    if (publish) {
      await prisma.page.update({
        where: { id: row.id },
        data: {
          status: "PUBLISHED",
          publishedSlug: row.slug,
          publishedAt: now,
          lastReviewedAt: now,
          published: buildPageSnapshot(row) as unknown as Prisma.InputJsonValue,
        },
      });
    }
    created++;
  }

  console.log(
    `Seed complete: ${created} item(s) created${publish ? " and published" : " as drafts"}.`,
  );
  console.log(
    "Review all starter copy (placeholders are marked with square brackets) before launch.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
