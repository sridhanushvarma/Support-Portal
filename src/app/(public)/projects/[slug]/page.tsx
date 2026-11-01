import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublishedProject, getSettings } from "@/lib/content/public";
import { resolveRedirect } from "@/lib/redirects";
import { pageMetadata } from "@/lib/seo";
import { ProjectDetail } from "@/components/site/project-detail";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) return { title: "Not found" };
  const meta = pageMetadata({
    title: project.seoTitle || project.title,
    description: project.seoDescription || project.summary,
    path: `/projects/${project.slug}`,
  });
  if (project.thumbnail)
    meta.openGraph = {
      ...meta.openGraph,
      images: [
        {
          url: project.thumbnail.url,
          width: project.thumbnail.width,
          height: project.thumbnail.height,
          alt: project.thumbnail.alt,
        },
      ],
    };
  return meta;
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) {
    const redirect = await resolveRedirect(`/projects/${slug}`);
    if (redirect) permanentRedirect(redirect.targetPath);
    notFound();
  }
  return <ProjectDetail project={project} settings={await getSettings()} />;
}
