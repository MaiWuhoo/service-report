import {
  createReport,
  getCompanyProfile,
  getCustomer,
  getNextReportId,
} from "./reportsApi";
import {
  instantiateSectionsFromTemplate,
  DEFAULT_COMPANY,
} from "./defaultTemplates";

export async function createReportFromTemplate(template, overrides = {}) {
  const { locationDoor, leadTechnician, customerId, ...extra } = overrides;

  let serviceProvider = DEFAULT_COMPANY;
  try {
    const profile = await getCompanyProfile();
    if (profile) serviceProvider = profile;
  } catch {
    // Firestore not reachable — fall back to the built-in company profile
  }

  // Customer is chosen at report/schedule creation time (not tied to the
  // template — templates are general and reusable across customers).
  let customer = { name: "-", address: "", logo: null };
  if (customerId) {
    try {
      const fetched = await getCustomer(customerId);
      if (fetched) customer = fetched;
    } catch {
      // fall back to the placeholder above
    }
  } else if (template.customer) {
    // Legacy templates that still have an embedded customer — keep working.
    customer = template.customer;
  }

  const reportId = await getNextReportId();

  const id = await createReport({
    reportId,
    locationDoor: locationDoor || template.locationDoor || "-",
    leadTechnician:
      leadTechnician || template.assignedTechnician || "Unassigned",
    dateOfService: new Date().toISOString().slice(0, 10),
    templateId: template.id,
    templateName: template.name,
    serviceProvider,
    customer,
    sections: instantiateSectionsFromTemplate(template),
    ...extra,
  });
  return id;
}
