// @ts-check
import { fileURLToPath } from "node:url";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

const repo = "https://github.com/jacobgoldfarb/Jevlish";

export default defineConfig({
  site: "https://jacobgoldfarb.github.io",
  base: "/Jevlish",
  vite: {
    resolve: {
      alias: {
        "@snippets": fileURLToPath(new URL("./snippets", import.meta.url)),
      },
    },
  },
  integrations: [
    starlight({
      title: "jevlish",
      description: "TypeScript expressions that compile to Jev requests.",
      social: [{ icon: "github", label: "GitHub", href: repo }],
      editLink: { baseUrl: `${repo}/edit/main/docs/` },
      lastUpdated: true,
      customCss: ["./src/styles/custom.css"],
      plugins: [
        starlightTypeDoc({
          entryPoints: ["../src/index.ts"],
          tsconfig: "../tsconfig.build.json",
          output: "reference",
          sidebar: { label: "Reference", collapsed: true },
          typeDoc: {
            excludePrivate: true,
            excludeInternal: true,
            readme: "none",
            // Emit the module overview as index.md so it lives at /reference/ rather than /reference/readme/.
            entryFileName: "index",
            sort: ["kind", "source-order"],
            parametersFormat: "table",
            propertiesFormat: "table",
            enumMembersFormat: "table",
            typeDeclarationFormat: "table",
          },
        }),
      ],
      sidebar: [
        {
          label: "Start",
          items: [
            { slug: "start/introduction" },
            { slug: "start/install" },
            { slug: "start/quickstart" },
          ],
        },
        {
          label: "Guides",
          items: [
            { slug: "guides/given" },
            { slug: "guides/from" },
            { slug: "guides/meanings" },
            { slug: "guides/scales" },
            { slug: "guides/choosing" },
            { slug: "guides/ask" },
            { slug: "guides/uncertainty" },
            { slug: "guides/running" },
            { slug: "guides/evidence" },
            { slug: "guides/runtime" },
            { slug: "guides/testing" },
          ],
        },
        {
          label: "Examples",
          items: [{ slug: "examples/support-desk" }, { slug: "examples/insights" }],
        },
        typeDocSidebarGroup,
      ],
    }),
  ],
});
