# Third-Party Notices

Data Horizon Studio source is licensed under GNU GPL version 3. The development and packaged runtime use third-party components under their own compatible licenses.

Direct build and runtime dependencies resolved by the 0.20.0 lockfile include:

| Component | Resolved version | License |
| --- | ---: | --- |
| Electron | 44.0.0 | MIT |
| esbuild | 0.25.12 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| Node.js type definitions | 24.13.3 | MIT |

Transitive packages reported by `pnpm licenses list` use MIT, BSD-2-Clause, ISC, or Apache-2.0 terms. The committed lockfile records the exact dependency graph.

Windows distributions retain Electron's `LICENSE` and `LICENSES.chromium.html` files and add `LICENSE.DATA-HORIZON` for this project. Those packaged files contain the controlling notices for redistributed runtime components.
