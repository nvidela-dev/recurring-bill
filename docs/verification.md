# Release verification — October 3, 2026

Confirmed locally for v1.1.0:

- Fresh configuration contains empty strings for every invoice setting.
- Nine tests pass, covering blank defaults, clearing imported rates, configurable invoice fields, validation, month-end windows, leap years, exact decimal money/tax rounding, manual dates, configuration persistence parsing, and PDF content.
- TypeScript and Vite production build pass; npm audit reports zero vulnerabilities.
- Browser preview shows only Start empty and Import a template, with no preloaded client.
- Empty setup shows empty required fields and refuses incomplete configuration.
- A fictional configuration persisted through browser reload: custom client, sender, rate, item label, EUR currency, 7.5% tax, and number prefix.
- Browser calculation for 2 hours at EUR 42.75 shows subtotal EUR 85.50, tax EUR 6.41, and total EUR 91.91; a manually selected date remains editable.
- Generated and visually inspected a fictional PDF containing the custom details, correct line amount, tax, total, date, payment terms, and terms.
- Scanned source and production frontend: no company-specific name, address/contact/tax identifier, personal issuer identity, or original personal rate is bundled. The separate private template file is outside the repository and is not a release asset.
- Universal release compilation succeeded for arm64 and x86_64; the ZIP's executable contains both architectures.
- Applied ad-hoc signing and verified the exact archive after extraction in a clean temporary directory with codesign --verify --deep --strict.
- The archive contains no saved user configuration or template file.

Limitations:

- This release is not Developer ID signed/notarized. No appropriate Apple signing identity is configured on the build machine. macOS may block downloaded builds.
- Packaged native interaction, save/cancellation, persistence through desktop relaunch, and Intel runtime behavior have not been verified. Computer-use permissions were not available for native interaction in this session.
- The GitHub release workflow is included for future tagged builds; local release verification does not claim a successful GitHub Actions run.
- Browser download initiation cannot guarantee that a user retained a file; normal use is the native app.

Recommended native smoke test: open the app, import your separately supplied template or configure empty fields, save settings, relaunch, verify the configuration, cancel one PDF save (number unchanged), and complete a save (number advances once). Open the saved PDF and check the date, hours, rate, and totals.
