import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublishedService, getRelatedProjects, getSettings } from "@/lib/content/public";
import { resolveRedirect } from "@/lib/redirects";
import { pageMetadata } from "@/lib/seo";
import { ServiceDetail } from "@/components/site/service-detail";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  if (!service) return { title: "Not found" };
  return pageMetadata({
    title: service.seoTitle || service.name,
    description: service.seoDescription || service.content.summary,
    path: `/services/${service.slug}`,
  });
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = await getPublishedService(slug);
  if (!service) {
    const redirect = await resolveRedirect(`/services/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  const [related, settings] = await Promise.all([getRelatedProjects(service.id, 3), getSettings()]);
  return <ServiceDetail service={service} related={related} settings={settings} />;
}
