// The conversation screen — renders any conversation:
// - the scene image (cross-fades as scenes change)
// - the text paragraphs (fade in staggered)
// - the name prompt (first/last name fields) — the intro conversation only
// - the choices (numbered, hover + keys)
// - the [done] state at the end
//
// Two modes:
// - start: the scenario's intro conversation (name prompt enabled)
// - mission: a mission's on-offer conversation (e.g. the intro mission) — no
//   name prompt, mission substitutions layered over the player's reserved set
//
// The conversation engine is parsed fresh on each run, against the player's
// live conditions store (per the reference). The completion endpoint (-1 accept,
// -2 decline, ...) is reported to the caller via onDone.

import { createScreen } from './Panel';
import { Conversation } from '../game/Conversation';
import { replace } from '../util/Format';
import type { PlayerInfo } from '../game/PlayerInfo';
import type { Audio } from '../audio/Audio';
import type { DataNode } from '../data/DataNode';
import type { Mission } from '../game/Mission';

const FORBIDDEN_CHARS = new Set(['/', '\\', '?', '*', ':', '|', '"', '<', '>', '~']);

const INTRO_KICKER = 'Intro';
const MISSION_KICKER = 'Quest';

export interface ConversationOptions {
  mode: 'start' | 'mission';
  mission?: Mission;
  conversationNode: DataNode | null;
  // The header text (kicker + title).
  kicker?: string;
  title?: string;
  onDone: (endpoint: number) => void;
}

interface Paragraph {
  text: string;
  scene: string | null;
}

interface ChoiceOption {
  text: string;
  index: number; // the raw element index (the reference's `next` element)
}

export class ConversationScreen {
  readonly element: HTMLElement;
  private audio: Audio;
  private player: PlayerInfo;
  private mission: Mission | null = null;
  private mode: 'start' | 'mission';
  private conversation: Conversation | null = null;
  private node = 0;
  private paragraphs: Paragraph[] = [];
  private choices: ChoiceOption[] = [];
  private activeChoice = 0;
  private done = false;
  private endpoint = -2;
  private nameFirst = '';
  private nameLast = '';
  private nameFocused: 0 | 1 = 0;
  private flicker = 0;
  private currentScene: string | null = null;
  private destroyed = false;
  private onDone: (endpoint: number) => void;

  // DOM
  private sceneWrap: HTMLElement;
  private sceneImg: HTMLImageElement;
  private textCol: HTMLElement;
  private choicesWrap: HTMLElement;
  private namePanel: HTMLElement;
  private firstNameInput: HTMLInputElement;
  private lastNameInput: HTMLInputElement;
  private doneButton: HTMLButtonElement;
  private logToast: HTMLElement;

  constructor(audio: Audio, player: PlayerInfo, options: ConversationOptions) {
    this.audio = audio;
    this.player = player;
    this.mode = options.mode;
    this.mission = options.mode === 'mission' ? (options.mission ?? null) : null;
    this.onDone = options.onDone;

    this.element = createScreen('conversation-screen');

    const inner = document.createElement('div');
    inner.className = 'conversation-inner';

    // Left: the scene.
    this.sceneWrap = document.createElement('div');
    this.sceneWrap.className = 'conversation-scene';
    this.sceneImg = document.createElement('img');
    this.sceneImg.className = 'conversation-scene-img';
    this.sceneImg.alt = 'scene';
    this.sceneWrap.appendChild(this.sceneImg);

    // Right: the dialogue.
    const body = document.createElement('div');
    body.className = 'conversation-body';

    const header = document.createElement('div');
    header.className = 'conversation-header';
    const kicker = document.createElement('div');
    kicker.className = 'conversation-kicker';
    kicker.textContent = options.kicker ?? (this.mode === 'start' ? INTRO_KICKER : MISSION_KICKER);
    const headerName = document.createElement('div');
    headerName.className = 'conversation-header-name';
    headerName.textContent = options.title ?? (this.mode === 'start' ? 'The bank' : (this.mission?.title ?? 'Quest'));
    header.append(kicker, headerName);

    this.textCol = document.createElement('div');
    this.textCol.className = 'conversation-text';

    this.choicesWrap = document.createElement('div');
    this.choicesWrap.className = 'conversation-choices';

    this.namePanel = document.createElement('div');
    this.namePanel.className = 'conversation-name';
    this.namePanel.style.display = 'none';

    const nameKicker = document.createElement('div');
    nameKicker.className = 'conversation-name-kicker';
    nameKicker.textContent = 'Sign your name';
    const nameFields = document.createElement('div');
    nameFields.className = 'conversation-name-fields';

    const firstWrap = document.createElement('label');
    firstWrap.className = 'conversation-name-field';
    const firstLabel = document.createElement('span');
    firstLabel.className = 'conversation-name-field-label';
    firstLabel.textContent = 'First name';
    this.firstNameInput = document.createElement('input');
    this.firstNameInput.className = 'conversation-name-input';
    this.firstNameInput.autocomplete = 'off';
    this.firstNameInput.spellcheck = false;
    this.firstNameInput.maxLength = 30;
    this.firstNameInput.placeholder = 'First';
    this.firstNameInput.addEventListener('input', () => {
      this.nameFirst = this.firstNameInput.value;
    });
    this.firstNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); this.focusNameField(1 - this.nameFocused); }
    });
    firstWrap.append(firstLabel, this.firstNameInput);

    const lastWrap = document.createElement('label');
    lastWrap.className = 'conversation-name-field';
    const lastLabel = document.createElement('span');
    lastLabel.className = 'conversation-name-field-label';
    lastLabel.textContent = 'Last name';
    this.lastNameInput = document.createElement('input');
    this.lastNameInput.className = 'conversation-name-input';
    this.lastNameInput.autocomplete = 'off';
    this.lastNameInput.spellcheck = false;
    this.lastNameInput.maxLength = 30;
    this.lastNameInput.placeholder = 'Last';
    this.lastNameInput.addEventListener('input', () => {
      this.nameLast = this.lastNameInput.value;
    });
    this.lastNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { e.preventDefault(); this.focusNameField(1 - this.nameFocused); }
    });
    lastWrap.append(lastLabel, this.lastNameInput);

    nameFields.append(firstWrap, lastWrap);

    const nameActions = document.createElement('div');
    nameActions.className = 'conversation-name-actions';
    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'conversation-name-confirm';
    confirmButton.innerHTML = '<span class="menu-key">Enter</span> Confirm';
    confirmButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    confirmButton.addEventListener('click', () => this.confirmName());
    nameActions.appendChild(confirmButton);
    const nameHint = document.createElement('div');
    nameHint.className = 'conversation-name-hint';
    nameHint.textContent = 'Tab switches fields';
    this.namePanel.append(nameKicker, nameFields, nameActions);
    this.namePanel.appendChild(nameHint);

    this.doneButton = document.createElement('button');
    this.doneButton.className = 'conversation-done';
    this.doneButton.textContent = '[ done ]';
    this.doneButton.style.display = 'none';
    this.doneButton.addEventListener('mouseenter', () => this.audio.play('soft'));
    this.doneButton.addEventListener('click', () => this.finish());

    this.logToast = document.createElement('div');
    this.logToast.className = 'conversation-toast';
    this.logToast.textContent = '▸ Logbook updated';
    this.logToast.style.display = 'none';

    body.append(header, this.textCol, this.namePanel, this.choicesWrap, this.doneButton, this.logToast);
    inner.append(this.sceneWrap, body);
    this.element.appendChild(inner);

    this.startConversation(options.conversationNode);
  }

  // --- conversation setup ──────────────────────────────────────────────────

  private startConversation(node: DataNode | null): void {
    if (!node) {
      this.done = true;
      this.endpoint = -2;
      this.choices = [];
      this.renderAll();
      return;
    }
    this.conversation = Conversation.parse(node, this.player.conditions, (m) => console.warn(m));

    if (!this.conversation || this.conversation.isEmpty()) {
      this.done = true;
      this.endpoint = -2;
      this.choices = [];
      this.renderAll();
      return;
    }

    this.goto(0);
  }

  // The player-level reserved substitutions (<first>, <ship>, <model>, ...).
  private reservedSubstitutions(): Map<string, string> {
    const s = new Map<string, string>();
    s.set('<first>', this.player.firstName);
    s.set('<last>', this.player.lastName);
    s.set('<original first>', this.player.firstName);
    s.set('<original last>', this.player.lastName);

    const flag = this.player.flagship();
    if (flag) {
      s.set('<ship>', flag.givenName);
      s.set('<model>', flag.model.name);
      s.set('<flagship>', flag.givenName);
      s.set('<flagship model>', flag.model.name);
    }

    s.set('<system>', this.player.systemName || 'Rutilicus');
    s.set('<current system>', this.player.systemName);
    if (this.player.planetName) s.set('<current planet>', this.player.planetName);
    s.set('<date>', this.player.date?.toString() ?? '');
    s.set('<day>', this.player.date?.longString() ?? '');

    if (this.player.startData) {
      const start = this.player.startData;
      s.set('<start planet>', start.getPlanetName());
      s.set('<start system>', start.getSystemName());
      s.set('<start date>', this.player.date?.toString() ?? '');
      s.set('<start long date>', this.player.date?.longString() ?? '');
      s.set('<start credits>', String(this.player.account.credits ?? 0));
      s.set('<start credit score>', String(this.player.account.creditScore ?? 0));
      s.set('<start debt>', String(this.player.account.totalDebt() ?? 0));
    }
    return s;
  }

  // The mission-level substitutions (the reference builds these in
  // Mission::Instantiate; the player's reserved set is applied on top).
  private missionSubstitutions(): Map<string, string> {
    const s = new Map<string, string>();
    if (!this.mission) return s;

    s.set('<planet>', this.mission.destination);
    s.set('<destination>', this.mission.destination);
    s.set('<origin>', this.mission.source);
    s.set('<bunks>', String(this.mission.passengers));
    s.set('<passengers>', this.mission.passengers === 1 ? 'passenger' : 'passengers');
    s.set('<fare>', this.mission.passengers === 1 ? 'a passenger' : `${this.mission.passengers} passengers`);
    for (const [key, value] of this.mission.substitutions) {
      s.set(key, value);
    }
    return s;
  }

  private substitutions(): Map<string, string> {
    // Mission substitutions first, then the player's reserved set on top
    // (the reference's AddPlayerSubstitutions runs last).
    const s = this.missionSubstitutions();
    for (const [key, value] of this.reservedSubstitutions()) s.set(key, value);
    return s;
  }

  private expandedText(raw: string): string {
    const subs = this.substitutions();
    return replace(raw, subs);
  }

  private goto(index: number, selectedChoice: number = -1): void {
    if (!this.conversation) return;

    // Scroll to the start of the new text (unless the conversation ended).
    if (index >= 0) {
      if (selectedChoice >= 0 && selectedChoice < this.choices.length) {
        // The chosen option text is added to the display.
        this.paragraphs.push({ text: this.choices[selectedChoice].text, scene: null });
      }
    }

    this.choices = [];
    this.done = false;
    this.node = index;

    // Mirror the reference's loop: advance through non-choice nodes until we
    // reach a node that offers choices, or the conversation ends.
    while (this.node >= 0 && !this.conversation.hasAnyChoices(this.node)) {
      const node = this.conversation.nodes[this.node];
      let choice = 0;

      // Skip empty choices (the name prompt) — they have no "next" to follow.
      if (this.conversation.isChoice(this.node)) {
        this.node = this.conversation.stepToNextNode(this.node);
        continue;
      }

      if (this.conversation.isBranch(this.node)) {
        // Branch nodes change the flow of the conversation based on the
        // player's condition variables rather than player input.
        choice = !this.conversation.conditions(this.node).test() ? 1 : 0;
      } else if (this.conversation.isAction(this.node)) {
        // Action nodes are able to perform various actions, e.g. changing
        // the player's conditions, granting payments, triggering events.
        const action = this.conversation.getAction(this.node);
        if (action) {
          action.apply(
            (entry) => this.player.addLogEntry(entry),
            (cat, heading, entry) => this.player.addSpecialLog(cat, heading, entry),
            this.player.conditions,
          );
          this.showToast();
        }
      } else if (this.conversation.shouldDisplayNode(this.node)) {
        // This is an ordinary conversation node which should be displayed.
        const text = node.elements[0].text;
        this.paragraphs.push({ text: this.expandedText(text), scene: node.scene });
      } else {
        // This conversation node should not be displayed, so skip its goto.
        this.node = this.conversation.stepToNextNode(this.node);
        continue;
      }

      this.node = this.conversation.nextNodeForChoice(this.node, choice);
    }

    if (this.node < 0) {
      this.done = true;
      this.endpoint = this.node;
      this.choices = [];
      this.renderAll();
      return;
    }

    // Display whatever choices this node offers.
    const total = this.conversation.choices(this.node);
    this.choices = [];
    for (let i = 0; i < total; ++i) {
      if (this.conversation.shouldDisplayNode(this.node, i)) {
        this.choices.push({
          text: this.expandedText(this.conversation.text(this.node, i)),
          index: i,
        });
      }
    }

    // Safeguard: if choices are empty but the node has choices, decline.
    if (this.choices.length === 0 && total !== 0) {
      this.node = -2;
      this.done = true;
      this.endpoint = -2;
      this.renderAll();
      return;
    }

    this.activeChoice = 0;
    this.renderAll();
  }

  // --- rendering ──────────────────────────────────────────────────────────

  private renderAll(): void {
    // Text paragraphs.
    this.textCol.innerHTML = '';
    this.paragraphs.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'conversation-paragraph';
      el.style.animationDelay = `${Math.min(i * 90, 900)}ms`;
      // Convert the reference's leading "\t" into branding-aligned indentation.
      el.innerHTML = this.paragraphHtml(p.text);
      this.textCol.appendChild(el);
    });

    // Scene.
    const currentScene = this.paragraphs.length > 0 ? this.paragraphs.filter(p => p.scene).pop()?.scene ?? null : null;
    this.updateScene(currentScene ?? this.startSceneName());

    // Choices / name prompt / done.
    const nodeIsName = this.conversation !== null && this.conversation.isChoice(this.node) && this.choices.length === 0 && !this.done;
    if (this.done) {
      this.namePanel.style.display = 'none';
      this.choicesWrap.style.display = 'none';
      this.doneButton.style.display = '';
    } else if (nodeIsName) {
      this.choicesWrap.style.display = 'none';
      this.doneButton.style.display = 'none';
      this.namePanel.style.display = '';
      this.renderNameInputs();
    } else {
      this.namePanel.style.display = 'none';
      this.doneButton.style.display = 'none';
      this.renderChoices();
    }
  }

  private paragraphHtml(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return escaped
      .replace(/\n\t/g, '<br><span class="conversation-indent"></span>')
      .replace(/\n/g, '<br>');
  }

  private updateScene(sceneName: string | null): void {
    if (this.currentScene === sceneName) return;
    this.currentScene = sceneName;
    if (!sceneName) {
      this.sceneWrap.classList.remove('is-shown');
      return;
    }
    const img = this.sceneImg;
    img.style.opacity = '0';
    img.src = `/content/images/${sceneName}.jpg`;
    const img2 = () => { img.style.opacity = '1'; };
    img.onload = img2;
    img.onerror = () => { img.style.opacity = '0'; };
    this.sceneWrap.classList.add('is-shown');
  }

  private startSceneName(): string | null {
    // The first scene set by the conversation.
    const first = this.conversation?.sceneNames ? [...this.conversation.sceneNames][0] ?? null : null;
    return first;
  }

  private renderNameInputs(): void {
    this.firstNameInput.value = this.nameFirst;
    this.lastNameInput.value = this.nameLast;
    this.focusNameField(this.nameFocused);
  }

  private renderChoices(): void {
    this.choicesWrap.style.display = '';
    this.choicesWrap.innerHTML = '';
    this.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'conversation-choice';
      if (i === this.activeChoice) btn.classList.add('is-active');
      const num = document.createElement('span');
      num.className = 'conversation-choice-num';
      num.textContent = `${i + 1}`;
      const text = document.createElement('span');
      text.className = 'conversation-choice-text';
      text.textContent = choice.text.trim();
      btn.append(num, text);
      btn.addEventListener('mouseenter', () => {
        if (this.activeChoice !== i) {
          this.activeChoice = i;
          this.renderChoices();
          this.audio.play('soft');
        }
      });
      btn.addEventListener('click', () => this.pickChoice(i));
      this.choicesWrap.appendChild(btn);
    });
  }

  // --- interactions ───────────────────────────────────────────────────────

  private pickChoice(i: number): void {
    if (!this.conversation) return;
    const elementIndex = this.choices[i]?.index;
    if (elementIndex === undefined) return;
    if (!this.conversation.choiceIsActive(this.node, elementIndex)) {
      this.audio.play('failure');
      return;
    }
    this.audio.play('normal');
    this.goto(this.conversation.nextNodeForChoice(this.node, elementIndex), i);
  }

  private focusNameField(side: number): void {
    this.nameFocused = side as 0 | 1;
    (side === 0 ? this.firstNameInput : this.lastNameInput).focus();
  }

  private validateName(): boolean {
    const first = this.nameFirst.trim();
    const last = this.nameLast.trim();
    if (first.length === 0 || last.length === 0) return false;
    if ([...first, ...last].some(c => FORBIDDEN_CHARS.has(c))) return false;
    return true;
  }

  private confirmName(): void {
    const first = this.nameFirst.trim();
    const last = this.nameLast.trim();
    if (!this.validateName()) {
      this.audio.play('failure');
      this.flickerName();
      return;
    }
    this.audio.play('target');
    this.player.setName(first, last);
    this.paragraphs.push({ text: `\t\tName: ${first} ${last}.\n`, scene: null });
    this.goto(this.node + 1);
  }

  private flickerName(): void {
    this.flicker = 18;
    this.namePanel.classList.add('is-flicker');
    window.setTimeout(() => this.namePanel.classList.remove('is-flicker'), 120);
  }

  private showToast(): void {
    this.logToast.style.display = '';
    this.logToast.classList.remove('is-shown');
    void this.logToast.offsetWidth;
    this.logToast.classList.add('is-shown');
    window.setTimeout(() => {
      if (!this.destroyed) this.logToast.style.display = 'none';
    }, 1800);
  }

  private finish(): void {
    this.audio.play('soft');
    this.onDone(this.endpoint);
  }

  // --- keyboard ───────────────────────────────────────────────────────────

  handleKey(event: KeyboardEvent): boolean {
    if (this.done) {
      if (event.key === 'Enter' || event.key === 'd' || event.key === 'D' || event.key === ' ') {
        this.finish();
        return true;
      }
      return false;
    }

    const nodeIsName = this.conversation !== null && this.conversation.isChoice(this.node) && this.choices.length === 0;

    if (nodeIsName) {
      if (event.key === 'Tab') {
        event.preventDefault();
        this.focusNameField(1 - this.nameFocused);
        return true;
      }
      if (event.key === 'Enter') {
        const first = this.nameFirst.trim();
        const last = this.nameLast.trim();
        if (first.length === 0 || last.length === 0) {
          // Toggle focus to the empty field (like the reference).
          this.focusNameField(first.length === 0 ? 0 : 1);
          this.audio.play('soft');
        } else {
          this.confirmName();
        }
        return true;
      }
      return false; // let the inputs handle typing
    }

    // Choices.
    if (this.choices.length > 0) {
      const total = this.choices.length;
      if (event.key === 'ArrowUp' && this.activeChoice > 0) {
        this.activeChoice -= 1;
        this.renderChoices();
        this.audio.play('soft');
        return true;
      }
      if (event.key === 'ArrowDown' && this.activeChoice + 1 < total) {
        this.activeChoice += 1;
        this.renderChoices();
        this.audio.play('soft');
        return true;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.pickChoice(this.activeChoice);
        return true;
      }
      if (/^[0-9]$/.test(event.key)) {
        const n = Number(event.key);
        if (n >= 1 && n <= total) {
          this.activeChoice = n - 1;
          this.pickChoice(n - 1);
          return true;
        }
      }
      return false;
    }

    return false;
  }

  // --- lifecycle ──────────────────────────────────────────────────────────

  mount(): void {
    requestAnimationFrame(() => {
      this.element.classList.add('is-visible');
      // Focus the right input when the name prompt is active.
      if (this.conversation && this.conversation.isChoice(this.node) && this.choices.length === 0) {
        this.focusNameField(this.nameFocused);
      }
    });
  }

  unmount(): void {
    this.destroyed = true;
    this.element.classList.remove('is-visible');
  }
}
