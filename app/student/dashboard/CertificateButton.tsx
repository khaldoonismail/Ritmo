"use client";

import { colors, radius, solidShadow } from "@/lib/theme";

// Generates a downloadable PDF certificate client-side with jsPDF — no
// server round trip, no stored file. Two kinds: reaching the student's
// current level, and finishing every assignment in their class.
export default function CertificateButton({
  kind,
  studentName,
  className,
  levelLabel,
}: {
  kind: "level" | "class";
  studentName: string;
  className: string;
  levelLabel: string;
}) {
  async function download() {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Outer decorative border.
    doc.setDrawColor(255, 185, 77); // colors.orange
    doc.setLineWidth(6);
    doc.rect(24, 24, pageWidth - 48, pageHeight - 48);
    doc.setDrawColor(43, 43, 43);
    doc.setLineWidth(1);
    doc.rect(36, 36, pageWidth - 72, pageHeight - 72);

    doc.setTextColor(43, 43, 43);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.text("Certificate of Achievement", pageWidth / 2, 120, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(15);
    doc.text("This certifies that", pageWidth / 2, 165, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.text(studentName, pageWidth / 2, 215, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(15);
    const description =
      kind === "level"
        ? `has reached the "${levelLabel}" level in ${className}`
        : `has completed every assignment in ${className}`;
    doc.text(description, pageWidth / 2, 255, { align: "center" });

    doc.setFontSize(13);
    doc.text("Ritmo Academy", pageWidth / 2, 305, { align: "center" });
    doc.text(new Date().toLocaleDateString(), pageWidth / 2, 328, { align: "center" });

    const safeName = studentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`ritmo-certificate-${kind}-${safeName}.pdf`);
  }

  return (
    <button
      onClick={download}
      style={{
        fontSize: "0.85rem",
        fontWeight: 800,
        padding: "0.6rem 1.1rem",
        borderRadius: radius.button,
        border: "none",
        background: colors.greenButton,
        boxShadow: solidShadow(3, colors.greenButtonShadow),
        color: colors.white,
        cursor: "pointer",
      }}
    >
      {kind === "level" ? `🏆 Download ${levelLabel} Certificate` : "🎓 Download Class Certificate"}
    </button>
  );
}
