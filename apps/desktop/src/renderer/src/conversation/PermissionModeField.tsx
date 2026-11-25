import { MODES } from './permissionModes';
import { useClaudeInfo } from './useModels';
import { Select } from '../settings/Select';
import { tr } from '../i18n';

// Modo nas Configurações: o campo de escolha das outras linhas, com o ícone de cada modo e o item
// "Padrão da conta" (valor vazio). Na conversa, o modo fica no PermissionModePicker.
export function PermissionModeField({ value, onChange }: { value: string; onChange: (mode: string) => void }) {
  const info = useClaudeInfo();
  const accountDefault = MODES.find((m) => m.value === info?.defaultPermissionMode);
  const DefaultIcon = (accountDefault ?? MODES[0]).icon;

  const options = [
    {
      value: '',
      label: tr('Padrão da conta', 'Account default') + (accountDefault ? ` - ${accountDefault.label}` : ''),
      Icon: DefaultIcon,
      danger: accountDefault?.danger,
    },
    ...MODES.map((m) => ({ value: m.value, label: m.label, Icon: m.icon, danger: m.danger })),
  ].map(({ Icon, ...option }) => ({
    ...option,
    leading: <Icon size={15} className={`shrink-0 ${option.danger ? 'text-red-400' : 'text-muted'}`} aria-hidden="true" />,
  }));

  return <Select value={value} onChange={onChange} label={tr('Modo', 'Mode')} options={options} />;
}
