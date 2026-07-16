export const DEFAULT_COMPANY = {
  name: "INNATES PLT",
  address: "8-01, Jalan Pulai Perdana 12, Taman Sri Pulai Perdana, 81300 Skudai, Johor.",
  logo: null,
};

export const DEFAULT_TEMPLATE = {
  id: "default",
  name: "Access Door - Standard",
  category: "Access Control",
  locationDoor: "",
  customer: {
    name: "TLP TERMINAL SDN BHD",
    address: "Bangunan Pentadbiran Langsat Marine Terminal, Pasir Gudang, Johor.",
    logo: null,
  },
  sections: [
    {
      sectionName: "Access Door IN",
      items: [
        { question: "Check and clean the appearance of the device" },
        { question: "Functional testing with face recognition" },
        { question: "Functional testing with pin number" },
        { question: "Functional testing with fingerprint" },
        { question: "Verify the software/firmware version" },
      ],
    },
    {
      sectionName: "Access Door OUT",
      items: [
        { question: "Check and clean the appearance of the device" },
        { question: "Functional testing with face recognition" },
        { question: "Functional testing with pin number" },
        { question: "Functional testing with fingerprint" },
        { question: "Verify the software/firmware version" },
      ],
    },
    {
      sectionName: "General",
      items: [
        { question: "Inspect and test router connectivity and performance" },
        { question: "Check the exit button/emergency release" },
        { question: "Check the electromagnetic lock" },
        { question: "Check the power supply status" },
        { question: "Check the battery status" },
        { question: "Ensure the cut-off voltage is within the acceptable range" },
      ],
    },
  ],
};

/** Deep-copies a template's sections into a fresh, editable report.sections array. */
export function instantiateSectionsFromTemplate(template) {
  return (template.sections ?? []).map((section) => ({
    sectionName: section.sectionName,
    items: (section.items ?? []).map((item, idx) => ({
      id: String(idx + 1),
      question: item.question,
      answer: "",
      remark: "",
    })),
  }));
}
