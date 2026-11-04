import { fireEvent, render, screen } from '@testing-library/react-native';

import { TaskRow } from '@/components/task-row';
import { I18nProvider } from '@/i18n';
import { SettingsProvider } from '@/state/settings';
import { AppThemeProvider } from '@/theme/theme-provider';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'pt', regionCode: 'BR' }], useLocales: () => [{ languageCode: 'pt', regionCode: 'BR' }] }));

const wrap = (ui: React.ReactElement) => (
  <SettingsProvider>
    <I18nProvider>
      <AppThemeProvider>{ui}</AppThemeProvider>
    </I18nProvider>
  </SettingsProvider>
);

describe('TaskRow (tela de fumaça)', () => {
  const task = { id: 't1', title: 'Ligar pro dentista', day: '2026-11-04', minutes: 600, reminder: true, done: false, changedAt: 1, createdAt: 1 };

  it('mostra o título e o horário, e marca ao tocar no checkbox', async () => {
    const onToggle = jest.fn();
    await render(wrap(<TaskRow task={task} onToggle={onToggle} />));
    expect(screen.getByText('Ligar pro dentista')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('sem horário, o botão de hora diz para definir um', async () => {
    await render(wrap(<TaskRow task={{ ...task, minutes: null }} onToggle={jest.fn()} />));
    expect(screen.getByText(/definir|horário/i)).toBeTruthy();
  });
});
