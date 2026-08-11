import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, Save, X } from "lucide-react";
import { getCompanyProfile, saveCompanyProfile } from "../lib/reportsApi";
import { DEFAULT_COMPANY } from "../lib/defaultTemplates";
import { compressImageToBlob } from "../lib/fileUtils";
import { uploadImageToCloudinary } from "../lib/cloudinaryUtils";

export default function SettingsPage() {
  const [name, setName] = useState(DEFAULT_COMPANY.name);
  const [address, setAddress] = useState(DEFAULT_COMPANY.address);
  const [logo, setLogo] = useState(null);
  const [companyStamp, setCompanyStamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const profile = await getCompanyProfile();
        if (profile) {
          setName(profile.name ?? DEFAULT_COMPANY.name);
          setAddress(profile.address ?? DEFAULT_COMPANY.address);
          setLogo(profile.logo ?? null);
          setCompanyStamp(profile.companyStamp ?? null);
        }
      } catch {
        // Firestore not reachable yet — form still usable with defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const blob = await compressImageToBlob(file, 600, 0.85);
      const url = await uploadImageToCloudinary(
        `company/logo-${Date.now()}`,
        blob,
      );
      setLogo(url);
    } catch (err) {
      alert(`Gagal muat naik logo: ${err.message}`);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleCompanyStampChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStamp(true);
    try {
      const blob = await compressImageToBlob(file, 500, 0.85);
      const url = await uploadImageToCloudinary(
        `company/stamp-${Date.now()}`,
        blob,
      );
      setCompanyStamp(url);
    } catch (err) {
      alert(`Gagal muat naik company stamp: ${err.message}`);
    } finally {
      setUploadingStamp(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await saveCompanyProfile({ name, address, logo, companyStamp });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save company profile:", err);
      alert(`Gagal simpan tetapan: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-ink">Settings</h2>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold uppercase text-navy-800">
          Company Profile
        </h3>
        <p className="mb-4 text-sm text-muted">
          This appears as the &quot;Service Provider&quot; on every checklist
          and generated PDF report.
        </p>

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            <label className="mb-1 block text-sm font-semibold text-ink">
              Company Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., INNATES PLT"
              className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            />

            <label className="mb-1 block text-sm font-semibold text-ink">
              Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              placeholder="Full company address"
              className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            />

            <label className="mb-1 block text-sm font-semibold text-ink">
              Company Logo
            </label>
            {logo ? (
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={logo}
                  alt="Company logo preview"
                  className="h-16 w-16 rounded-md border border-border object-contain p-1"
                />
                <button
                  onClick={() => setLogo(null)}
                  className="flex items-center gap-1 rounded-md border border-danger-600 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-100"
                >
                  <X size={13} /> Remove
                </button>
              </div>
            ) : (
              <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border py-6 text-center hover:bg-surface">
                <ImagePlus size={20} className="mb-2 text-navy-700" />
                <span className="text-sm font-semibold text-navy-700">
                  {uploadingLogo ? "Uploading…" : "Upload Logo"}
                </span>
                <span className="text-xs text-muted">PNG or JPG</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleLogoChange}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
            )}

            <label className="mb-1 mt-4 block text-sm font-semibold text-ink">
              Digital COP (Company Stamp)
            </label>
            {companyStamp ? (
              <div className="mb-4 flex items-center gap-3">
                <img
                  src={companyStamp}
                  alt="Company stamp preview"
                  className="h-16 w-40 rounded-md border border-border object-contain p-1"
                />
                <button
                  onClick={() => setCompanyStamp(null)}
                  className="flex items-center gap-1 rounded-md border border-danger-600 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-100"
                >
                  <X size={13} /> Remove
                </button>
              </div>
            ) : (
              <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border py-6 text-center hover:bg-surface">
                <ImagePlus size={20} className="mb-2 text-navy-700" />
                <span className="text-sm font-semibold text-navy-700">
                  {uploadingStamp ? "Uploading…" : "Upload Company Stamp"}
                </span>
                <span className="text-xs text-muted">PNG or JPG</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleCompanyStampChange}
                  disabled={uploadingStamp}
                  className="hidden"
                />
              </label>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
            >
              <Save size={16} />{" "}
              {saving ? "Saving…" : saved ? "Saved ✓" : "Save Company Profile"}
            </button>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted">
          Customer name, address and logo are managed separately so they can be
          reused across templates — set them up under{" "}
          <Link
            to="/customers"
            className="font-semibold text-navy-700 hover:underline"
          >
            Customers
          </Link>
          , then pick one when building a checklist template.
        </p>
      </section>
    </div>
  );
}
