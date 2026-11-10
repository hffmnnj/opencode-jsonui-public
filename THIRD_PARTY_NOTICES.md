# Third-party notices

This package's own source is MIT licensed. Dependencies keep their own licenses;
the package license does not relicense them. Pinned versions are in `bun.lock`.

| Direct runtime dependency | Version | Declared license |
| --- | --- | --- |
| @json-render/core | 0.21.0 | Apache-2.0 |
| @json-render/image | 0.21.0 | Apache-2.0 |
| @opencode/plugin | 2.0.18 | MIT |
| @resvg/resvg-js | 2.6.2 | MPL-2.0 |
| echarts | 6.1.0 | Apache-2.0 |
| fontkit | 2.0.4 | MIT |
| react | 19.2.7 | MIT |
| sharp | 0.35.4 | Apache-2.0 |
| zod | 4.4.3 | MIT |

These declarations were read from the installed package manifests. Distribution
must retain the upstream license/notice files supplied with these dependencies
and their transitive dependencies, including native resvg/sharp libraries.
No upstream library source is modified here. The six small contextual icons and
the synthetic example schematic were authored for this package.

## Bundled IBM Plex fonts

Source: [IBM/plex](https://github.com/IBM/plex), official static TrueType assets,
retrieved September 2026. Copyright © 2017 IBM Corp. Reserved Font Name: Plex.
Licensed under the **SIL Open Font License 1.1**. The complete upstream text is
retained at [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt). Fonts are unmodified,
bundled with this software, and not sold separately. Exported chart SVGs and the
standalone example HTML embed those same static font files.

SHA-256 checksums:

```text
975dcda37d80f038dcd143c22e33ca2d97a0cc5a929aace1c749153b0fe1afa5  IBMPlexSans-Regular.ttf
a20caf8286023a6a7a85e40b1d2a4ae9fc3e3b1f9eda8f4c542dd4986af67bb1  IBMPlexSans-SemiBold.ttf
7c6fbddca4b700be918f5f6183d9bd4464fa427fe435f0b480d77fe2bb8c5a43  IBMPlexMono-Regular.ttf
```

Font coverage is that of the bundled IBM Plex faces. There is no system-font or
network-font fallback. Additional scripts/emoji would require a separately
licensed and tested font addition.
