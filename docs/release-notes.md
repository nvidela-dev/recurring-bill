A standalone offline macOS invoice app for recurring monthly work.

Download **Recurring-Bill-macOS-universal.zip**, extract it, and move **Recurring Bill.app** to Applications. Includes both Intel and Apple Silicon executables.

- Starts empty or imports a separately shared template file.
- Each coworker configures their own sender identity and hourly rate.
- Invoice details, item label, rate, currency, tax, numbering, and terms are editable in Settings.
- Hours, date, and total remain the normal monthly workflow.
- Automatically selects month-end in the first/last ten days; otherwise requires an explicit date choice. Always manually editable.
- PDF generation and configuration stay local; no API account or credentials required.

No client templates, company details, sender identity, or hourly rate are bundled in this release. **SHA256SUMS.txt** contains the ZIP checksum.

The app is ad-hoc signed, not Developer ID signed/notarized. macOS may block downloaded builds. Native save/relaunch interaction and Intel runtime behavior have not been verified; see the repository's verification notes for details.
