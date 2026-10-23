import { useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionCard, ViewTabs } from '@/components/app';
import { useAppSettings, useSaveSetting } from '@/hooks/useAppData';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_LABEL,
  ROLE_ORDER,
  effectivePermissions,
  type PermissionDef,
  type RolePermissions,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/database';

type EditableRole = keyof RolePermissions;
const EDITABLE: EditableRole[] = ['SUPPORT', 'WAREHOUSE', 'INVOICING'];
const LABELS = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items).map((d) => [d.id, d.label]));

/** Normalised form used to compare drafts and to save: only what each role really gets. */
const normalise = (p: RolePermissions): RolePermissions =>
  Object.fromEntries(EDITABLE.map((r) => [r, [...effectivePermissions(p[r] ?? [])].sort()])) as RolePermissions;
const sameAs = (a: RolePermissions, b: RolePermissions) => JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));

interface Cell {
  checked: boolean;
  disabled: boolean;
  note?: string;
}

function cellFor(def: PermissionDef, role: UserRole, draft: RolePermissions): Cell {
  if (role === 'ADMIN') return { checked: true, disabled: true, note: 'Admins can do everything' };
  if (def.locked === 'everyone') return { checked: true, disabled: true, note: 'Always on' };
  if (def.locked === 'admin') return { checked: false, disabled: true, note: 'Admins only' };
  const raw = draft[role] ?? [];
  if (def.impliedBy && raw.includes(def.impliedBy)) return { checked: true, disabled: true, note: `Included with ${LABELS[def.impliedBy]}` };
  if (def.requires && !effectivePermissions(raw).has(def.requires)) return { checked: false, disabled: true, note: `Needs ${LABELS[def.requires]}` };
  return { checked: raw.includes(def.id), disabled: false };
}

function PermissionLabel({ def }: { def: PermissionDef }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {def.label}
        {def.locked && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Fixed" />}
      </p>
      <p className="text-xs text-muted-foreground">{def.hint}</p>
    </div>
  );
}

export function RolePermissionsEditor({ counts }: { counts: Partial<Record<UserRole, number>> }) {
  const { data: settings, isLoading } = useAppSettings();
  const save = useSaveSetting();
  const { toast } = useToast();
  const saved = settings?.role_permissions ?? DEFAULT_ROLE_PERMISSIONS;
  const [draft, setDraft] = useState<RolePermissions | null>(null);
  const [phoneRole, setPhoneRole] = useState<UserRole>('SUPPORT');
  const current = draft ?? saved;
  const dirty = draft !== null && !sameAs(draft, saved);
  const isDefault = sameAs(current, DEFAULT_ROLE_PERMISSIONS);

  const toggle = (role: UserRole, def: PermissionDef, on: boolean) => {
    if (role === 'ADMIN') return;
    const list = current[role] ?? [];
    const next = on ? [...new Set([...list, def.id])] : list.filter((p) => p !== def.id);
    setDraft({ ...current, [role]: next });
  };

  const onSave = () => {
    if (!draft) return;
    save.mutate(
      { key: 'role_permissions', value: normalise(draft) },
      {
        onSuccess: () => {
          setDraft(null);
          toast({ title: 'Permissions saved', description: 'People get the new access the next time they open or refresh the portal.' });
        },
        onError: (e) => toast({ title: 'Could not save permissions', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' }),
      },
    );
  };

  const checkbox = (def: PermissionDef, role: UserRole) => {
    const c = cellFor(def, role, current);
    return (
      <span title={c.note} className="inline-grid size-8 place-items-center">
        <Checkbox
          checked={c.checked}
          disabled={c.disabled || save.isPending}
          onCheckedChange={(v) => toggle(role, def, v === true)}
          aria-label={`${ROLE_LABEL[role]}: ${def.label}${c.note ? ` (${c.note})` : ''}`}
          className="size-[18px]"
        />
      </span>
    );
  };

  const peopleCount = (r: UserRole) => {
    const n = counts[r] ?? 0;
    return `${n} ${n === 1 ? 'person' : 'people'}`;
  };

  return (
    <SectionCard
      title="Roles & permissions"
      description="Choose which pages and actions each role gets. Admins always have full access."
      action={
        <Button variant="ghost" size="sm" onClick={() => setDraft(DEFAULT_ROLE_PERMISSIONS)} disabled={isLoading || isDefault || save.isPending}>
          <RotateCcw />
          <span className="hidden sm:inline">Reset to defaults</span>
          <span className="sm:hidden">Reset</span>
        </Button>
      }
      bodyClassName="p-0"
    >
      {/* Tablet / desktop matrix */}
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border text-left">
              <th className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Permission</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} scope="col" className="w-28 px-2 py-2.5 text-center">
                  <span className="block text-sm font-semibold text-foreground">{ROLE_LABEL[r]}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground tabular">{peopleCount(r)}</span>
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((g) => (
            <tbody key={g.title} className="divide-y divide-border">
              <tr>
                <th colSpan={ROLE_ORDER.length + 1} scope="colgroup" className="bg-muted/40 px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </th>
              </tr>
              {g.items.map((def) => (
                <tr key={def.id} className="transition-colors duration-150 hover:bg-muted/30">
                  <td className="px-5 py-2.5"><PermissionLabel def={def} /></td>
                  {ROLE_ORDER.map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">{checkbox(def, r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Phone: one role at a time */}
      <div className="md:hidden">
        <div className="px-4">
          <ViewTabs<UserRole>
            views={ROLE_ORDER.map((r) => ({ id: r, label: ROLE_LABEL[r] }))}
            value={phoneRole}
            onChange={setPhoneRole}
          />
        </div>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          <span className="tabular">{peopleCount(phoneRole)}</span> ·{' '}
          {phoneRole === 'ADMIN' ? "Admins can do everything. This can't be changed." : 'Changes apply to everyone with this role.'}
        </p>
        {PERMISSION_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mt-3 bg-muted/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
            <ul className="divide-y divide-border">
              {g.items.map((def) => {
                const c = cellFor(def, phoneRole, current);
                return (
                  <li key={def.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <PermissionLabel def={def} />
                      {c.note && phoneRole !== 'ADMIN' && <p className="mt-0.5 text-[11px] font-medium text-faint">{c.note}</p>}
                    </div>
                    {checkbox(def, phoneRole)}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
        Permissions control what people see and can do in the portal. Data access between staff roles is shared in the database, so
        use roles for workflow rather than to hide sensitive data.
      </p>

      {/* Room for the floating save bar so it never covers the last rows */}
      {dirty && <div aria-hidden className="h-16" />}
      {dirty && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
          <div role="status" className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl bg-foreground py-1.5 pl-4 pr-1.5 text-background shadow-overlay animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="whitespace-nowrap text-sm font-medium">Unsaved permission changes</span>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={save.isPending}
              className="h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium text-background/80 transition-colors hover:bg-background/10 hover:text-background disabled:opacity-50"
            >
              Discard
            </button>
            <Button size="sm" variant="secondary" onClick={onSave} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
