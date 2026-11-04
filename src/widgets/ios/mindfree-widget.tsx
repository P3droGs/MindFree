import { Button, Circle, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  multilineTextAlignment,
  strikethrough,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { MindFreeWidgetProps } from '@/widgets/widget-content';

/**
 * Widget "MindFree" do iPhone. De dia mostra as tarefas de hoje (dá para marcar como feita
 * sem abrir o app, no iOS 17 ou mais novo); à noite vira o convite para esvaziar a mente.
 * Roda isolado do app: tudo o que ele usa precisa estar dentro da função.
 */
const MindFreeLayout = (props: MindFreeWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const small = environment.widgetFamily === 'systemSmall';
  const colors = props.palette;
  const labels = props.labels;
  const day = { background: '#FFF7EC', text: '#2B1D12', secondary: '#6E5A48', done: '#7A6553' };
  const night = { background: '#10142E', text: '#EEF0FF', secondary: '#A9AED6' };
  // À noite, tocar começa a gravar: a tela inicial abre a gravação (com o consentimento antes, se faltar).
  const RECORD_URL = 'mindfree://?start=gravar';
  const rounded = (size: number, weight: 'semibold' | 'bold' | 'heavy') =>
    font({ size, weight, design: 'rounded' });

  if (props.mode === 'noite') {
    const mic = (size: number) => (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        <Circle modifiers={[foregroundStyle(colors.nightAccent)]} />
        <Image systemName="mic.fill" size={Math.round(size * 0.38)} color={colors.nightOnAccent} />
      </ZStack>
    );
    const message = labels.nightMessage;

    if (small) {
      return (
        <VStack
          spacing={10}
          modifiers={[containerBackground(night.background, 'widget'), widgetURL(RECORD_URL)]}>
          {mic(72)}
          <Text modifiers={[rounded(15, 'heavy'), foregroundStyle(night.text), multilineTextAlignment('center')]}>
            {labels.record}
          </Text>
        </VStack>
      );
    }

    return (
      <HStack spacing={12} modifiers={[containerBackground(night.background, 'widget'), widgetURL(RECORD_URL)]}>
        <VStack alignment="leading" spacing={4}>
          <HStack spacing={5}>
            <Image systemName="moon.fill" size={13} color={colors.nightAccentText} />
            <Text modifiers={[rounded(13, 'heavy'), foregroundStyle(colors.nightAccentText), kerning(0.8)]}>
              {props.nightTime}
            </Text>
          </HStack>
          <Text modifiers={[rounded(18, 'heavy'), foregroundStyle(night.text), lineLimit(2)]}>
            {labels.nightTitle}
          </Text>
          <Text
            modifiers={[rounded(13, 'semibold'), foregroundStyle(night.secondary), lineLimit(3), minimumScaleFactor(0.85)]}>
            {message}
          </Text>
        </VStack>
        <Spacer />
        {mic(78)}
      </HStack>
    );
  }

  const tasks = props.tasks;
  const pending = tasks.filter((task) => !task.done);
  const dayContainer = [
    containerBackground(day.background, 'widget'),
    widgetURL('mindfree://'),
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
  ];

  if (small) {
    const next = pending[0];
    const title = next ? next.title : tasks.length > 0 ? labels.allDoneToday : labels.record;
    const time = next ? next.time || labels.today : tasks.length > 0 ? '✓' : props.nightTime;
    return (
      <VStack alignment="leading" spacing={6} modifiers={dayContainer}>
        <Text modifiers={[rounded(12, 'heavy'), foregroundStyle(day.secondary), kerning(1)]}>{labels.next.toUpperCase()}</Text>
        <Text modifiers={[rounded(17, 'heavy'), foregroundStyle(day.text), lineLimit(3)]}>{title}</Text>
        <Spacer />
        <Text modifiers={[rounded(30, 'heavy'), foregroundStyle(colors.dayAccent), monospacedDigit()]}>{time}</Text>
      </VStack>
    );
  }

  const remaining =
    tasks.length === 0
      ? labels.freeDay
      : pending.length === 0
        ? labels.allDone
        : pending.length === 1
          ? labels.leftOne
          : labels.leftMany.replace('{n}', String(pending.length));
  const shown = tasks.length <= 3 ? tasks : pending.concat(tasks.filter((task) => task.done)).slice(0, 3);
  const toggle = (id: string) => ({
    tasks: tasks.map((task) => (task.id === id ? { ...task, done: !task.done, changedAt: Date.now() } : task)),
  });

  return (
    <VStack alignment="leading" spacing={4} modifiers={dayContainer}>
      <HStack spacing={6}>
        <Image systemName="sun.max.fill" size={15} color={colors.dayAccent} />
        <Text modifiers={[rounded(15, 'heavy'), foregroundStyle(day.text)]}>{labels.today}</Text>
        <Spacer />
        <Text modifiers={[rounded(13, 'bold'), foregroundStyle(day.secondary)]}>{remaining}</Text>
      </HStack>
      {tasks.length === 0 ? (
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[rounded(15, 'bold'), foregroundStyle(day.text)]}>{labels.noTasks}</Text>
          <Text modifiers={[rounded(13, 'semibold'), foregroundStyle(day.secondary), lineLimit(2)]}>
            {labels.emptyDay}
          </Text>
        </VStack>
      ) : (
        shown.map((task) => (
          <HStack key={task.id} spacing={8}>
            <Button
              target={'toggle-' + task.id}
              onPress={() => toggle(task.id)}
              modifiers={[
                buttonStyle('plain'),
                accessibilityLabel((task.done ? labels.uncheck : labels.check).replace('{title}', task.title)),
              ]}>
              <Image systemName={task.done ? 'checkmark.circle.fill' : 'circle'} size={21} color={colors.dayAccent} />
            </Button>
            <Text
              modifiers={[
                rounded(15, 'bold'),
                foregroundStyle(task.done ? day.done : day.text),
                strikethrough({ isActive: task.done, pattern: 'solid' }),
                lineLimit(1),
              ]}>
              {task.title}
            </Text>
            <Spacer />
            <Text modifiers={[rounded(14, 'heavy'), foregroundStyle(day.secondary), monospacedDigit()]}>
              {task.time}
            </Text>
          </HStack>
        ))
      )}
    </VStack>
  );
};

export const MindFreeWidget = createWidget<MindFreeWidgetProps>('MindFree', MindFreeLayout, {
  mode: 'dia',
  tasks: [],
  doneToday: 0,
  nightTime: '22:30',
  morningTime: '07:00',
  palette: { dayAccent: '#B45309', nightAccent: '#B9A6FF', nightOnAccent: '#10142E', nightAccentText: '#B9A6FF' },
  // Só até o app abrir pela primeira vez; depois os textos vêm no idioma escolhido.
  labels: {
    today: 'Hoje',
    next: 'Próxima',
    record: 'Esvaziar a mente',
    nightTitle: 'Hora de esvaziar a mente',
    freeDay: 'dia livre',
    allDone: 'Tudo feito!',
    leftOne: 'falta 1',
    leftMany: 'faltam {n}',
    noTasks: 'Nenhuma tarefa para hoje.',
    emptyDay: 'Às 22:30, esvazie a mente e eu organizo o resto.',
    allDoneToday: 'Tudo feito por hoje',
    nightMessage: 'Fale por um minuto. Amanhã às 07:00 te entrego tudo organizado.',
    check: 'Concluir: {title}',
    uncheck: 'Desmarcar: {title}',
  },
});
