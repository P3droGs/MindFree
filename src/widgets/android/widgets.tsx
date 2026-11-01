'use no memo';
// Os widgets do Android são desenhados chamando as funções direto, sem o React por trás:
// o React Compiler não pode transformá-las.

import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import {
  nextUp,
  remainingLabel,
  SKY_STAR_POSITIONS,
  visibleTasks,
  type MindFreeLabels,
  type MindFreeWidgetProps,
  type SkyWidgetProps,
  type WidgetTask,
} from '@/widgets/widget-content';

export const ANDROID_WIDGET_NAMES = ['MindFree', 'MindFreeAtalho', 'SeuCeu'] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGET_NAMES)[number];

export type AndroidWidgetProps = { mindfree: MindFreeWidgetProps; sky: SkyWidgetProps };

/** Ação de toque que marca ou desmarca uma tarefa (tratada em widget-tasks.tsx). */
export const TOGGLE_TASK = 'TOGGLE_TASK';

const DAY = { background: '#FFF7EC', text: '#2B1D12', secondary: '#6E5A48', done: '#7A6553' } as const;
const NIGHT = { background: '#10142E', border: '#2A3060', text: '#EEF0FF', secondary: '#A9AED6' } as const;
/** À noite, tocar no widget começa a gravar: a tela inicial abre a gravação (com o consentimento antes, se faltar). */
const RECORD_URI = 'mindfree://?start=gravar';
const SKY = { background: '#070A1C', border: '#1E2350', text: '#EEF0FF', secondary: '#C9CDEB' } as const;

const EXTRA_BOLD = 'Nunito_800ExtraBold';
const SEMI_BOLD = 'Nunito_600SemiBold';
const RADIUS = 28;

// Mesmos ícones de traço (Feather) de src/components/icon.tsx, como texto SVG.
const ICONS = {
  check: '<polyline points="20 6 9 17 4 12"/>',
  mic:
    '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>' +
    '<line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun:
    '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="1.5" x2="12" y2="3.5"/><line x1="12" y1="20.5" x2="12" y2="22.5"/>' +
    '<line x1="4.6" y1="4.6" x2="6" y2="6"/><line x1="18" y1="18" x2="19.4" y2="19.4"/><line x1="1.5" y1="12" x2="3.5" y2="12"/>' +
    '<line x1="20.5" y1="12" x2="22.5" y2="12"/><line x1="4.6" y1="19.4" x2="6" y2="18"/><line x1="18" y1="6" x2="19.4" y2="4.6"/>',
};

function icon(name: keyof typeof ICONS, color: string, strokeWidth = 2.4): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`
  );
}

function skyDrawing(stars: number): string {
  const width = 140;
  const height = 70;
  const lit = Math.min(stars, SKY_STAR_POSITIONS.length);
  const points = SKY_STAR_POSITIONS.map(([x, y]) => [x * width, y * (height - 10) + 10]);
  const line =
    lit > 1
      ? `<polyline points="${points
          .slice(0, lit)
          .map((point) => point.join(','))
          .join(' ')}" fill="none" stroke="#B9A6FF" stroke-opacity="0.45" stroke-width="1"/>`
      : '';
  const dots = points
    .map(([x, y], index) =>
      index < lit
        ? `<circle cx="${x}" cy="${y}" r="3" fill="#FFF4D6"/>`
        : `<circle cx="${x}" cy="${y}" r="2.2" fill="#EEF0FF" fill-opacity="0.22"/>`,
    )
    .join('');
  const moon = `<circle cx="130" cy="9" r="8" fill="#C7B8FF"/><circle cx="134" cy="6" r="7" fill="${SKY.background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${moon}${line}${dots}</svg>`;
}

function MicCircle({ size, palette }: { size: number; palette: MindFreeWidgetProps['palette'] }) {
  const iconSize = Math.round(size * 0.4);
  return (
    <FlexWidget
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.nightAccent as `#${string}`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <SvgWidget svg={icon('mic', palette.nightOnAccent, 2.2)} style={{ width: iconSize, height: iconSize }} />
    </FlexWidget>
  );
}

function TaskRow({ task, accent, labels }: { task: WidgetTask; accent: string; labels: MindFreeLabels }) {
  const color = accent as `#${string}`;
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', height: 38 }}>
      <FlexWidget
        clickAction={TOGGLE_TASK}
        clickActionData={{ id: task.id }}
        accessibilityLabel={(task.done ? labels.uncheck : labels.check).replace('{title}', task.title)}
        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
        <FlexWidget
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: color,
            backgroundColor: task.done ? color : 'rgba(0, 0, 0, 0)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {task.done ? <SvgWidget svg={icon('check', '#FFFFFF', 3.4)} style={{ width: 13, height: 13 }} /> : null}
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flex: 1, paddingLeft: 2, paddingRight: 8 }}>
        <TextWidget
          text={task.title}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 15, fontFamily: EXTRA_BOLD, color: task.done ? DAY.done : DAY.text }}
        />
      </FlexWidget>
      <TextWidget text={task.time} style={{ fontSize: 14, fontFamily: EXTRA_BOLD, color: DAY.secondary }} />
    </FlexWidget>
  );
}

/** Widget 4x2 "Hoje e esta noite". */
function TodayWidget({ props }: { props: MindFreeWidgetProps }) {
  const { palette } = props;

  if (props.mode === 'noite') {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: RECORD_URI }}
        style={{
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: NIGHT.background,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: NIGHT.border,
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: 12,
        }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 4 }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
            <SvgWidget svg={icon('moon', palette.nightAccentText)} style={{ width: 16, height: 16 }} />
            <TextWidget
              text={props.nightTime}
              style={{ fontSize: 13, fontFamily: EXTRA_BOLD, color: palette.nightAccentText as `#${string}` }}
            />
          </FlexWidget>
          <TextWidget
            text={props.labels.nightTitle}
            maxLines={2}
            style={{ fontSize: 19, fontFamily: EXTRA_BOLD, color: NIGHT.text }}
          />
          <TextWidget
            text={props.labels.nightMessage}
            maxLines={3}
            truncate="END"
            style={{ fontSize: 14, fontFamily: SEMI_BOLD, color: NIGHT.secondary }}
          />
        </FlexWidget>
        <MicCircle size={84} palette={palette} />
      </FlexWidget>
    );
  }

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: DAY.background,
        borderRadius: RADIUS,
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: 'column',
        flexGap: 2,
      }}>
      <FlexWidget
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          <SvgWidget svg={icon('sun', palette.dayAccent)} style={{ width: 18, height: 18 }} />
          <TextWidget text="Hoje" style={{ fontSize: 16, fontFamily: EXTRA_BOLD, color: DAY.text }} />
        </FlexWidget>
        <TextWidget text={remainingLabel(props)} style={{ fontSize: 13, fontFamily: EXTRA_BOLD, color: DAY.secondary }} />
      </FlexWidget>
      {props.tasks.length === 0 ? (
        <FlexWidget style={{ flexDirection: 'column', flexGap: 4, paddingTop: 6 }}>
          <TextWidget
            text={props.labels.noTasks}
            style={{ fontSize: 15, fontFamily: EXTRA_BOLD, color: DAY.text }}
          />
          <TextWidget
            text={props.labels.emptyDay}
            maxLines={2}
            style={{ fontSize: 14, fontFamily: SEMI_BOLD, color: DAY.secondary }}
          />
        </FlexWidget>
      ) : (
        visibleTasks(props.tasks).map((task) => <TaskRow key={task.id} task={task} accent={palette.dayAccent} labels={props.labels} />)
      )}
    </FlexWidget>
  );
}

/** Widget 2x2: de dia a próxima tarefa, à noite o atalho para gravar. */
function ShortcutWidget({ props }: { props: MindFreeWidgetProps }) {
  if (props.mode === 'noite') {
    return (
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: RECORD_URI }}
        style={{
          width: 'match_parent',
          height: 'match_parent',
          backgroundColor: NIGHT.background,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: NIGHT.border,
          padding: 16,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexGap: 12,
        }}>
        <MicCircle size={76} palette={props.palette} />
        <TextWidget
          text={props.labels.record}
          style={{ fontSize: 15, fontFamily: EXTRA_BOLD, color: NIGHT.text, textAlign: 'center' }}
        />
      </FlexWidget>
    );
  }

  const next = nextUp(props);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: DAY.background,
        borderRadius: RADIUS,
        paddingHorizontal: 18,
        paddingVertical: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
      <FlexWidget style={{ flexDirection: 'column', flexGap: 6 }}>
        <TextWidget
          text={props.labels.next.toUpperCase()}
          style={{ fontSize: 12, fontFamily: EXTRA_BOLD, color: DAY.secondary, letterSpacing: 0.08 }}
        />
        <TextWidget
          text={next.title}
          maxLines={3}
          truncate="END"
          style={{ fontSize: 17, fontFamily: EXTRA_BOLD, color: DAY.text }}
        />
      </FlexWidget>
      <TextWidget
        text={next.time}
        style={{ fontSize: 30, fontFamily: EXTRA_BOLD, color: props.palette.dayAccent as `#${string}` }}
      />
    </FlexWidget>
  );
}

/** Widget 2x2 "Seu céu". */
function SkyWidget({ props }: { props: SkyWidgetProps }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: SKY.background,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: SKY.border,
        paddingHorizontal: 18,
        paddingVertical: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
      <SvgWidget svg={skyDrawing(props.stars)} style={{ width: 'match_parent', height: 70 }} />
      <FlexWidget style={{ flexDirection: 'column', flexGap: 2 }}>
        <TextWidget text={props.title} style={{ fontSize: 15, fontFamily: EXTRA_BOLD, color: SKY.text }} />
        <TextWidget
          text={props.caption}
          maxLines={2}
          style={{ fontSize: 13, fontFamily: EXTRA_BOLD, color: SKY.secondary }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export function renderAndroidWidget(name: string, props: AndroidWidgetProps) {
  switch (name) {
    case 'MindFreeAtalho':
      return <ShortcutWidget props={props.mindfree} />;
    case 'SeuCeu':
      return <SkyWidget props={props.sky} />;
    default:
      return <TodayWidget props={props.mindfree} />;
  }
}
