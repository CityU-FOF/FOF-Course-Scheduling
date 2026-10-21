# Third-party notices

Runtime files bundled for offline execution (v3):

- Vue 3.5.22, production global build. MIT. Source: https://unpkg.com/vue@3.5.22/dist/vue.global.prod.js . Copyright (c) 2018-present, Yuxi (Evan) You and Vue contributors. Full license: vendor/VUE-LICENSE.
- SheetJS Community Edition 0.20.3, full browser build. Apache-2.0. Source: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js . Copyright (C) SheetJS LLC. Full license: vendor/SHEETJS-LICENSE. Original file header retained.
- v2 used Tailwind CSS 3.4.17 (MIT). v3 styles.css is handwritten and does not depend on Tailwind. The earlier input.css and license remain as historical source only; do not rebuild v3 styles from that input.

The FOF application derives from the HTML supplied by its owner for this task. No license for that original source was specified; this project does not unilaterally relicense it. Third-party components retain their respective licenses. UniTime, FET and Timefold are comparison references only; their code is not included.


v3.2 additions:

- interact.js 1.10.28 (MIT). Copyright (c) 2012-present Taye Adeyemi <dev@taye.me>. Repository: https://github.com/taye/interact.js . Unmodified browser bundle: https://unpkg.com/interactjs@1.10.28/dist/interact.min.js . Full license: vendor/INTERACT-LICENSE. FOF's integration adapter is pointer-dnd.js; the bundle is not modified.
- Papa Parse 5.7.0 (MIT). Copyright (c) 2015 Matthew Holt. Repository: https://github.com/mholt/PapaParse . Unmodified browser bundle: https://unpkg.com/papaparse@5.7.0/papaparse.min.js . Full license: vendor/PAPAPARSE-LICENSE. The bundle is not modified.
- assets/fof-logo.png is the faculty logo supplied by the user, copied without image alteration for this application. It is not covered by the above library licenses; faculty branding rights remain with their owner.

Timefold's school-timetabling documentation informed the soft preference design of the FOF candidate helper. No Timefold implementation or Java solver is bundled or copied.
