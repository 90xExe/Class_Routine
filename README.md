# VU CSE Routine Workspace

A responsive routine workspace for students, teachers and classroom checks.

## Open directly

Run:

```text
python app.py
```

The website opens automatically in the default browser. No package installation
or build step is required.

## Main views

- **For students:** choose semester and section, then use Day view or Full routine.
- **For teachers:** choose a teacher to see every course, room, section and time.
- **Classroom explorer:** search a room number to see occupied and available
  slots across all routines currently loaded.
- Save the current Student or Teacher setup as the device's default view.
- Browse by date, academic week or the complete weekly grid.

## Data coverage

`routine.json` contains a complete scan of the official CSE selector catalog:

- 12 semesters and sections A through T were checked (240 combinations).
- 38 published section routines were found.
- 545 class entries, 75 teachers and 40 rooms are included.

Room availability and teacher schedules are cross-checked against every
published routine found in that official scan.

## Publish with GitHub Pages

Push this folder to a GitHub repository. In **Settings -> Pages**, select
**Deploy from a branch**, the `main` branch and `/ (root)`.

`app.py` is the local launcher. GitHub Pages serves `index.html` directly.

## Automatic official-data sync

The included GitHub Action checks the signed-in official portal every six hours.
It updates `routine.json` and republishes GitHub Pages only when routine data
actually changes.

In the GitHub repository, open **Settings -> Secrets and variables -> Actions**
and add these repository secrets:

- `VU_STUDENT_ROLL`
- `VU_STUDENT_PASSWORD`

Then open **Settings -> Actions -> General -> Workflow permissions** and allow
**Read and write permissions**. The workflow can also be started manually from
**Actions -> Sync official routine -> Run workflow**.

The VU portal currently uses plain HTTP rather than HTTPS. Although GitHub
Secrets hide values from the repository and logs, the portal connection itself
is not encrypted. Prefer a dedicated account if one is available. To avoid
storing credentials in GitHub, run the same sync locally:

```text
python -m pip install -r requirements.txt
python sync_routines.py
```

The local command prompts for the student ID and password without saving them.
