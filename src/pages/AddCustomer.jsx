import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, ImagePlus, X } from "lucide-react";
import { createCustomer, getCustomer, updateCustomer } from "../lib/reportsApi";
import { compressImageToBlob } from "../lib/fileUtils";
import { uploadImageToCloudinary } from "../lib/cloudinaryUtils";

export default function AddCustomer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const c = await getCustomer(id);
      if (c) {
        setName(c.name ?? "");
        setAddress(c.address ?? "");
        setLogo(c.logo ?? null);
      }
      setLoading(false);
    })();
  }, [id, isEditing]);

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const blob = await compressImageToBlob(file, 600, 0.85);
      const url = await uploadImageToCloudinary(
        `customers/logo-${Date.now()}`,
        blob,
      );
      setLogo(url);
    } catch (err) {
      alert(`Gagal muat naik logo: ${err.message}`);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      alert("Sila isi nama customer.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name, address, logo };
      if (isEditing) {
        await updateCustomer(id, payload);
      } else {
        await createCustomer(payload);
      }
      navigate("/customers");
    } catch (err) {
      console.error("Failed to save customer:", err);
      alert(`Gagal simpan customer: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-ink">
          {isEditing ? "Edit Customer" : "New Customer"}
        </h2>
        <p className="text-sm text-muted">
          This record can be reused across as many checklist templates as you
          like.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="mb-1 block text-sm font-semibold text-ink">
          Customer Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., TLP Terminal Sdn Bhd"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-sm font-semibold text-ink">
          Address
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          placeholder="Full customer/site address"
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
        />

        <label className="mb-1 block text-sm font-semibold text-ink">
          Logo
        </label>
        {logo ? (
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Customer logo preview"
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
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border py-6 text-center hover:bg-surface">
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
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-md border border-border bg-white py-3 text-sm font-bold text-ink hover:bg-surface"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-md bg-navy-800 py-3 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-60"
        >
          <Save size={16} /> {saving ? "Saving…" : "Save Customer"}
        </button>
      </div>
    </div>
  );
}
