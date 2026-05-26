# AI Context — ioTech

> **Knowledge base for AI agents and the ioTech assistant.**  
> These files are injected into system prompts so agents make correct ESP32 hardware decisions.

---

## How It Works

```
ai-context/
├── esp32/
│   ├── models.md                    ← ESP32 variants, specs, comparison, ioTech recommendations
│   ├── gpio-safety.md               ← SAFE/WARNING/FORBIDDEN GPIOs per board
│   └── iotech-firmware-standard.md  ← Mandatory architecture, MQTT topics, OTA flow
├── prompts/
│   └── firmware-generator-rules.md  ← Agent rules: validation, code style, forbidden patterns
└── README.md                        ← This file
```

**These files are READ-ONLY for agents.** They describe the world as it exists.  
They do NOT replace `board-context.js`, `driver-catalog.js`, or `io_board.h` — they complement them with human-readable technical rationale.

---

## Usage

### For the AI Assistant (prompt-builder.js)
The `models.md` and `gpio-safety.md` content can be injected into the system prompt to give the LLM deeper ESP32 knowledge beyond what `board-context.js` provides.

### For Code Generation Agents
Agents that produce firmware C++ code MUST load `firmware-generator-rules.md` and cross-reference `gpio-safety.md` before assigning any GPIO.

### For Human Developers
Use these files as a quick reference when:
- Adding a new driver → check `models.md` for board compatibility.
- Debugging GPIO issues → check `gpio-safety.md` for pin conflicts.
- Onboarding new team members → `iotech-firmware-standard.md` explains the architecture.

---

## Maintenance

When adding a new ESP32 variant or driver:
1. Update `ai-context/esp32/models.md` — add board row + driver compatibility.
2. Update `ai-context/esp32/gpio-safety.md` — add SAFE/WARNING/FORBIDDEN list.
3. Update `ai-context/prompts/firmware-generator-rules.md` if new patterns emerge.
4. Update `board-context.js` and `io_board.h` for the actual implementation.

**Never let the docs diverge from the code.** If a GPIO changes in `io_board.h`, update `gpio-safety.md` in the same commit.

---

## File Size Budget
Each file is kept under 5KB for economical token usage in AI prompts.
If a file exceeds this, split by topic — don't let one file bloat.
