# Contributing to the project

This file will describe different aspects (naming commits, creating PRs) on how to contribute to the project.

- [Contributing to the project](#contributing-to-the-project)
  - [Before committing](#before-committing)
  - [Commit Message Format](#commit-message-format)
    - [Commit Message Header](#commit-message-header)
      - [Type](#type)
      - [Root & Workspace](#root--workspace)
      - [Summary](#summary)
      - [Examples of commit headers](#examples-of-commit-headers)
    - [Commit Message Body](#commit-message-body)
    - [Commit Message Footer](#commit-message-footer)
    - [Examples of commit message](#examples-of-commit-message)
  - [Code Reviews](#code-reviews)
    - [Branch naming convention](#branch-naming-convention)
      - [Feature branch](#feature-branch)
      - [Bug fixes branch](#bug-fixes-branch)
    - [Preparing Pull Request](#preparing-pull-request)
    - [Code Review Process](#code-review-process)

## Before committing

Before committing your changes, it's also a good practice to run several commands beforehand to see more detailed possible errors or warnings, especially if you are just starting to work with this monorepo. You can execute the relevant commands across the entire monorepo or in those packages where you made changes regarding **code style** compliance checks. To do this, run the command:

```bash
pnpm lint
```

You can also create a preliminary **local build** before committing:

```bash
pnpm build
```

## Commit Message Format

_This specification is inspired by the [Conventional Commits message format](https://www.conventionalcommits.org/en/v1.0.0/)._

This repository is a monorepo, so we need some precise rules over how our Git commit messages must be formatted. This format leads to **easier to read commit history**, **structured, atomic changes** which may help in future for more complex workflows.

Each commit message should consist of a **header**, a **body**, and a **footer**.

```git
<header>
[BLANK LINE]
<body>
[BLANK LINE]
<footer>
```

Since git message by default is just a text field **like HTML Textarea**, we need to create some structuring rules by ourselves.

- `[BLANK LINE]`'s are required to separate the structure of the message.
- The `header` is mandatory and must conform to the [Commit Message Header](#commit-message-header) format.
- The `body` is not mandatory but very desirable. If present, it must conform to the [Commit Message Body](#commit-message-body) format.
- The `footer` is mandatory only for commits based on some JIRA tickets. The [Commit Message Footer](#commit-message-footer) format describes what the footer is used for and the structure it must have.

### Commit Message Header

The `<type>` and `<summary>` fields are mandatory, the `(<root>/<workspace>)` fields are optional.

_Recommended max character for commit header is 72, after that GitLab will truncate the message._

#### Type

Must be one of the following:

- **build**: Changes that affect the build system or external dependencies (example: `webpack`, `esbuild`, `npm`, `pnpm`)
- **ci**: Changes to CI/CD configuration files and scripts
- **docs**: Documentation only changes
- **feat**: A new feature, piece of code that didn't exist
- **fix**: A existing defect correction
- **perf**: A code change that improves performance in any domain
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **test**: Adding missing unit tests or correcting existing ones
- **infra**: Changes related to deployment and infrastructure
- **e2e**: Anything related to End-to-End tests
- **typo**: A misspelling fix that don't change any logic in the code
- **chore**: A change that does not impact directly the code, some housekeeping work (example: `.gitignore`, `.editorconfig`, IDE configs)

#### Root & Workspace

A `root` is a logical group of multiple related workspaces.

A `workspace` is something that can be moved easily to a separate git repository and can become a self-sustained project, it has its own configs, `README.md`, and `package.json` file.

#### Summary

Use the summary field to provide a laconic yet meaningful description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize the first letter
- no dot (`.`) at the end
- don't use the commit type in summary, example: `fix: fix issue`

Ideally a commit summary should complete the following sentence:

```git
If this commit is applied, it will <summary>
```

#### Examples of commit headers

An atomic change to one package

```git
feat(apps/cli/data-manager): add parsing script
```

> This should be the **ideal commit header**, so try to aim for atomic changes!

A change that affects the entire scope (2 or more packages under the same scope)

```git
feat(apps): switch to graphql instead of fetch
```

> This commit indicates that the entire scope was affected by the change, so there is no point in enumerating all the packages. If you still want to add the packages affected, try to create first a generic commit with the changes for the entire scope, then commits for each affected package.

A change that affects the entire repo (2 or more scopes)

```git
fix: upgrade vulnerable dependencies
```

> This should be least desirable commit headers, try to avoid it. Such type of commits should be acceptable when some global changes happens, like migrating to a new 3rd party, infrastructure changes, security updates and so on. An exception may be changes to documentation, misspelling and other changes not related directly to the code itself.

### Commit Message Body

Explain the motivation for the change in the commit message body. Commit message body should explain _why_ you are making the change. You can include a comparison of the previous behavior with the new behavior in order to illustrate the impact of the change. Describe more the technical aspect rather than business logic. Add here any descriptions of tips, hacks, quirks or any strange code that at the first glance should be refactored.

If you think that commit does not need a message body, leave a blank line between `header` and `footer`.

```git
<header>
[BLANK LINE]
<footer>
```

### Commit Message Footer

Footer is the place for meta-information about the commit, like any related GitHub pull request ID, JIRA ticket IDs, or maybe a commit hash that is related somehow to this commit. For JIRA tickets indicate just its ID like `MDS-000`.

Footer might be missing for commit types like `docs`, `typo`, `chore` and so on. For commit types like `fix`, `feat`, `perf`, `refactor` at least JIRA ticket ID is mandatory.

Separate multiple references by comma. Group reference by type in one line.

```git
<github-pr>, <github-pr>
<commit-hash>, <commit-hash>
<jira-ticket>, <jira-ticket>, <jira-ticket>
```

### Examples of commit message

A commit consisting of header and footer:

- Header has: `type`, `scope`, `package` and `summary`
- Body is missing
- Footer has: 2 JIRA ticket references and a commit reference

```git
feat(apps/cli/data-manager): add parsing script

19fccb4a
B2CR-240, B2CR-241
```

A commit consisting of header, body and footer:

- Header has: `type`, `scope` and `summary`, `package` is missing
- Body has 2 lines of description
- Footer has a reference to a JIRA ticket, 2 Github PR references and a commit has reference

```git
feat(apps/cli/data-manager): add parsing script

Since lists are rendering a big number of items, list component is using now virtual scrolling.
This will boost the performance on pages with big lists.

B2CR-240
#25, #34
19fccb4a
```

A commit consisting just of header:

- Header has: `type` and `summary`, `scope` and `package` are missing
- Body is missing
- Footer is missing

```git
docs: add git commit guidelines
```

## Code Reviews

We are following [Gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) branching strategy to accommodate continuous delivery process. On high level it looks as follows:

- Start making changes by creating a feature branch
- Open Pull Request once feature is ready for code review and functionality has been implemented
- Once PR is reviewed, checked, and approved by peers merge it to the `main` branch

### Branch naming convention

#### Feature branch

Feature branches should follow the convention: `feature/<issue-number>-<descriptive-name>` where

- `<issues-number>`: a linked JIRA story, e.g. `MDS-001`
- `<descriptive-name>`: a short descriptive name of the feature, words are separated by dashes

#### Bug fixes branch

In cases when developer is working on a bug ticket, developer should create a branch named as follows: `fix/<issue-number>-<descriptive-name>`. Please notice the only difference with feature branch is the `fix` prefix.

### Preparing Pull Request

- Once feature is ready make sure all local checks have passed and feature branch contains latest changes from `develop`
- [Create a Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) and add the ticket number to the title, e.g. `MDS-000 Updating documentation`
  - List down the changes and any additional notes (test instructions, how-tos, etc.) in the PR description
- PR is created against `main` branch (destination)

### Code Review Process

- Assign at least **two** reviewers from your team in the PR
  - It is preferred to keep the number small (just two) unless you think more people should spend time on reviewing your work
- Make sure relevant team members are added as reviewers, e.g.
- PR can be merged if
  - All comments and suggestions have been addressed and resolved
  - All checks have passed
  - You got **two** approvals
- The PR author is responsible for merging the PR into `main`. That includes resolving merge conflicts if any.
  - The issue status in JIRA should be updated accordingly (e.g. story should be moved forward)
- [Commit rebasing](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges#rebase-and-merge-your-commits) is enforced for PRs so that commit history remains linear in `main` branch

**Note:** You can create a [draft pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests#draft-pull-requests) in order to mark it as not yet ready for code review, e.g. "Work In Progress" or validating the build in CI. Draft PR can be converted later to a full fledged PR when it is ready for review.
