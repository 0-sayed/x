import {
  isPermissionKey as isContractPermissionKey,
  permissionKeys,
  type PermissionKey,
} from '@materiabill/contracts';

export type PermissionArea =
  | 'workspace'
  | 'projects'
  | 'agreement_terms'
  | 'schedule'
  | 'draws'
  | 'payables'
  | 'continuity'
  | 'budget'
  | 'materials'
  | 'suggestions'
  | 'subcontractors'
  | 'submittals'
  | 'documents'
  | 'signoffs'
  | 'snags'
  | 'people_roles'
  | 'branding'
  | 'settings'
  | 'audit'
  | 'search';

export type PermissionCatalogEntry = {
  readonly key: PermissionKey;
  readonly area: PermissionArea;
  readonly labelEn: string;
};

export const permissionCatalog = [
  { key: 'workspace.view', area: 'workspace', labelEn: 'View workspace' },
  { key: 'projects.view', area: 'projects', labelEn: 'View projects' },
  { key: 'projects.create', area: 'projects', labelEn: 'Create projects' },
  { key: 'projects.edit', area: 'projects', labelEn: 'Edit projects' },
  { key: 'projects.archive', area: 'projects', labelEn: 'Archive projects' },
  { key: 'agreement_terms.view', area: 'agreement_terms', labelEn: 'View agreement terms' },
  {
    key: 'agreement_terms.configure',
    area: 'agreement_terms',
    labelEn: 'Configure agreement terms',
  },
  { key: 'schedule.view', area: 'schedule', labelEn: 'View schedule' },
  { key: 'schedule.manage', area: 'schedule', labelEn: 'Manage schedule' },
  { key: 'schedule.propose_baseline', area: 'schedule', labelEn: 'Propose baseline' },
  { key: 'milestones.complete', area: 'schedule', labelEn: 'Complete milestones' },
  { key: 'draws.view', area: 'draws', labelEn: 'View draws' },
  { key: 'draws.create', area: 'draws', labelEn: 'Create draws' },
  { key: 'draws.submit', area: 'draws', labelEn: 'Submit draws' },
  { key: 'draws.release', area: 'draws', labelEn: 'Release draws' },
  { key: 'draws.release_retention', area: 'draws', labelEn: 'Release retention' },
  { key: 'payables.view', area: 'payables', labelEn: 'View payables' },
  { key: 'payables.create', area: 'payables', labelEn: 'Create payables' },
  { key: 'payables.pay', area: 'payables', labelEn: 'Mark payables paid' },
  { key: 'continuity.view', area: 'continuity', labelEn: 'View continuity' },
  { key: 'continuity.pause', area: 'continuity', labelEn: 'Pause continuity' },
  { key: 'budget.view', area: 'budget', labelEn: 'View budget' },
  { key: 'budget.manage', area: 'budget', labelEn: 'Manage budget' },
  { key: 'budget.set_audience', area: 'budget', labelEn: 'Set budget audience' },
  { key: 'materials.view', area: 'materials', labelEn: 'View materials' },
  { key: 'materials.create', area: 'materials', labelEn: 'Create materials' },
  { key: 'materials.edit', area: 'materials', labelEn: 'Edit materials' },
  { key: 'materials.receive', area: 'materials', labelEn: 'Receive materials' },
  { key: 'materials.use', area: 'materials', labelEn: 'Use materials' },
  { key: 'materials.manage_po', area: 'materials', labelEn: 'Manage purchase orders' },
  { key: 'suggestions.view', area: 'suggestions', labelEn: 'View suggestions' },
  { key: 'suggestions.resolve', area: 'suggestions', labelEn: 'Resolve suggestions' },
  { key: 'subcontractors.view', area: 'subcontractors', labelEn: 'View subcontractors' },
  { key: 'subcontractors.create', area: 'subcontractors', labelEn: 'Create subcontractors' },
  { key: 'subcontractors.edit', area: 'subcontractors', labelEn: 'Edit subcontractors' },
  {
    key: 'subcontractors.manage_compliance',
    area: 'subcontractors',
    labelEn: 'Manage subcontractor compliance',
  },
  { key: 'submittals.view', area: 'submittals', labelEn: 'View submittals' },
  { key: 'submittals.create', area: 'submittals', labelEn: 'Create submittals' },
  { key: 'submittals.review', area: 'submittals', labelEn: 'Review submittals' },
  { key: 'submittals.approve', area: 'submittals', labelEn: 'Approve submittals' },
  { key: 'variations.view', area: 'submittals', labelEn: 'View variations' },
  { key: 'variations.create', area: 'submittals', labelEn: 'Create variations' },
  { key: 'variations.approve', area: 'submittals', labelEn: 'Approve variations' },
  { key: 'documents.view', area: 'documents', labelEn: 'View documents' },
  { key: 'documents.create', area: 'documents', labelEn: 'Create documents' },
  {
    key: 'documents.send_for_signature',
    area: 'documents',
    labelEn: 'Send documents for signature',
  },
  { key: 'documents.void', area: 'documents', labelEn: 'Void documents' },
  { key: 'manage_documents', area: 'documents', labelEn: 'Manage documents' },
  { key: 'certificates.view', area: 'documents', labelEn: 'View certificates' },
  { key: 'certificates.generate', area: 'documents', labelEn: 'Generate certificates' },
  { key: 'signoffs.view', area: 'signoffs', labelEn: 'View sign-offs' },
  { key: 'snags.view', area: 'snags', labelEn: 'View snags' },
  { key: 'snags.create', area: 'snags', labelEn: 'Create snags' },
  { key: 'snags.assign', area: 'snags', labelEn: 'Assign snags' },
  { key: 'snags.fix', area: 'snags', labelEn: 'Fix snags' },
  { key: 'manage_snags', area: 'snags', labelEn: 'Manage snags' },
  { key: 'people.view', area: 'people_roles', labelEn: 'View people' },
  { key: 'roles.view', area: 'people_roles', labelEn: 'View roles' },
  { key: 'roles.create', area: 'people_roles', labelEn: 'Create roles' },
  { key: 'roles.edit', area: 'people_roles', labelEn: 'Edit roles' },
  { key: 'manage_roles', area: 'people_roles', labelEn: 'Manage roles' },
  {
    key: 'user_role_assignments.manage',
    area: 'people_roles',
    labelEn: 'Manage user role assignments',
  },
  { key: 'branding.view', area: 'branding', labelEn: 'View branding' },
  { key: 'branding.manage', area: 'branding', labelEn: 'Manage branding' },
  { key: 'settings.view', area: 'settings', labelEn: 'View settings' },
  { key: 'settings.manage_defaults', area: 'settings', labelEn: 'Manage setting defaults' },
  { key: 'audit.view', area: 'audit', labelEn: 'View audit events' },
  { key: 'search.use', area: 'search', labelEn: 'Use search' },
] as const satisfies readonly PermissionCatalogEntry[];

export const contractorPermissionKeys = permissionCatalog.map((entry) => entry.key);

export type DefaultRoleTemplateKey = 'workspaceAdmin' | 'projectManager' | 'finance' | 'viewer';

export type DefaultRoleTemplate = {
  readonly key: DefaultRoleTemplateKey;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly permissions: readonly PermissionKey[];
};

function pickPermissions(keys: readonly PermissionKey[]): readonly PermissionKey[] {
  return keys;
}

const viewPermissions = permissionKeys.filter(
  (key) => key.endsWith('.view') || key === 'search.use',
);

export const defaultRoleTemplates = {
  workspaceAdmin: {
    key: 'workspaceAdmin',
    nameEn: 'Workspace Admin',
    nameAr: 'مدير مساحة العمل',
    permissions: permissionKeys,
  },
  projectManager: {
    key: 'projectManager',
    nameEn: 'Project Manager',
    nameAr: 'مدير المشروع',
    permissions: pickPermissions([
      'workspace.view',
      'projects.view',
      'projects.create',
      'projects.edit',
      'schedule.view',
      'schedule.manage',
      'schedule.propose_baseline',
      'milestones.complete',
      'draws.submit',
      'materials.view',
      'materials.create',
      'materials.edit',
      'materials.receive',
      'materials.use',
      'materials.manage_po',
      'suggestions.view',
      'suggestions.resolve',
      'subcontractors.view',
      'subcontractors.create',
      'subcontractors.edit',
      'subcontractors.manage_compliance',
      'submittals.view',
      'submittals.create',
      'submittals.review',
      'submittals.approve',
      'variations.view',
      'variations.create',
      'variations.approve',
      'documents.view',
      'documents.create',
      'documents.send_for_signature',
      'documents.void',
      'manage_documents',
      'certificates.view',
      'certificates.generate',
      'signoffs.view',
      'snags.view',
      'snags.create',
      'snags.assign',
      'snags.fix',
      'manage_snags',
    ]),
  },
  finance: {
    key: 'finance',
    nameEn: 'Finance',
    nameAr: 'المالية',
    permissions: pickPermissions([
      'workspace.view',
      'draws.view',
      'draws.create',
      'draws.submit',
      'draws.release',
      'draws.release_retention',
      'payables.view',
      'payables.create',
      'payables.pay',
      'budget.view',
      'budget.manage',
      'budget.set_audience',
      'continuity.view',
      'continuity.pause',
      'audit.view',
    ]),
  },
  viewer: {
    key: 'viewer',
    nameEn: 'Viewer',
    nameAr: 'مشاهد',
    permissions: viewPermissions,
  },
} as const satisfies Record<DefaultRoleTemplateKey, DefaultRoleTemplate>;

export function isPermissionKey(value: string): value is PermissionKey {
  return isContractPermissionKey(value);
}
