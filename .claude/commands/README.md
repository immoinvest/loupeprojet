# Claude Code Skills

Custom slash commands for Claude Code — my personal development pipeline.

## Skills (slash commands)

| Skill                | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `/new-feature`       | Master orchestrator: Discovery → Specs → Architecture → Implement → QA → Security → Push |
| `/bug-fix`           | TDD-driven: Diagnose → Reproduce (RED) → Fix (GREEN) → Verify → Push                     |
| `/implement`         | Code each user story with quality gates and incremental commits                          |
| `/feature-discovery` | Analyze a raw feature request into a structured discovery document                       |
| `/specs`             | Transform discovery into Epics, User Stories (Gherkin), API contracts                    |
| `/architecture`      | Design the technical blueprint before writing code                                       |
| `/qa-tests`          | Full test pyramid with vicious edge cases                                                |
| `/security-audit`    | OWASP audit with 0-100 scoring and false-positive filtering                              |
| `/security-review`   | PR-focused security review of pending changes                                            |
| `/cleanup-push`      | Final step: lint, build, tests, push, documentation updates                              |

## References (shared guidelines)

| File                                  | Content                                                       |
| ------------------------------------- | ------------------------------------------------------------- |
| `references/clean-code-guidelines.md` | SRP, design patterns, error handling, logging, validation     |
| `references/quality-gates.md`         | 11 automated gates before every commit                        |
| `references/security-rules.md`        | Security patterns, decision tree, false-positive exclusions   |
| `references/domain-examples.md`       | Concrete code examples (endpoints, scoring, React components) |
| `references/preflight-checklist.md`   | Pre-implementation verification checklist                     |
| `references/recovery-protocol.md`     | How to resume after interruption or failure                   |

## How to use

Copy the skills into your project's `.claude/commands/` directory:

```bash
# In your project root
mkdir -p .claude/commands
cp -r path/to/claude-skills/*.md .claude/commands/
cp -r path/to/claude-skills/references .claude/commands/
```

Then invoke with `/new-feature`, `/bug-fix`, etc. in Claude Code.
