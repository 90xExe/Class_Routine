# VU CSE and NFE Routine Workspace

A mobile- and desktop-friendly routine website for Varendra University CSE and
NFE students and teachers. It provides department-specific student schedules,
teacher profiles, classroom occupancy, free-room checks and complete weekly
routines from one interface.

## Features

- **Department dropdown:** choose CSE or NFE from the top header. Every semester,
  section, teacher, classroom and saved default stays department-aware.
- **Automatic first sync:** uploading the workflow or sync scripts to `main`
  starts the official CSE and NFE import automatically. Scheduled refreshes then
  run every six hours.
- **Student view:** select a semester and section, then view the selected day or
  the full weekly routine.
- Click or press Enter on any class card to open its class details. Matched
  teachers use the selected department's official faculty directory for name,
  designation, email, photo and profile link, with Copy controls where useful.
- Only semesters and sections with a published routine appear in the selectors.
- **Live class status:** today's classes automatically show `UPCOMING`,
  `RUNNING` or `ENDED` using Bangladesh time.
- **Teacher view:** type a teacher's name to see their courses, rooms, sections
  and class times. Selecting an exact teacher also shows a compact profile with
  designation, email, official profile photo/link and quick Copy controls. CSE
  keeps the supplied contact numbers; NFE contact numbers stay hidden until a
  verified source is available.
- **Classroom explorer:** type a room number to see occupied and available slots
  after cross-checking every published routine.
- Free periods and breaks are shown with their start time, end time and duration.
- Off days are clearly marked in red.
- The calendar shows only today and upcoming dates; past dates cannot be selected.
- Student off days include one useful learning task that stays consistent for
  that date, semester and section.
- A Student or Teacher setup can be saved as the device's default view.
- Responsive light/dark interface with locally hosted Oxanium typography.

## Run on your computer

Python 3 is the only requirement. Open a terminal inside the project folder and
run:

```bash
python app.py
```

The website opens directly in the default browser. If it does not open
automatically, visit:

```text
http://127.0.0.1:8000/
```

Press `Ctrl+C` in the terminal to stop the local website.

## How to use

### For a student

1. Select **For students**.
2. Select a semester. Only semesters with loaded routines are listed.
3. Select a section. Only published sections for that semester are listed.
4. Choose today or an upcoming date from the calendar, or use the left/right
   arrows. Past dates are automatically hidden and blocked.
5. Select **Day view** for one day or **Full routine** for the whole week.
6. Use **Save as my default** to remember the selection on that device.

### For a teacher

1. Select **For teachers**.
2. Start typing the teacher's name and choose it from the suggestion list.
3. Use **Day view** or **Full routine** as required.
4. Select **Save as my default** to remember the teacher on that device.

### Find a classroom

1. Type the room number in **Classroom explorer**.
2. Choose a date to check that day.
3. Each slot will show whether the room is occupied or available, including the
   course, teacher and section when occupied.

## Deploy to GitHub Pages

### 1. Upload the project

Create a public GitHub repository and upload the complete contents of this
project folder to the repository's `main` branch.

Keep the folder structure unchanged. In particular, confirm these files are
present:

```text
index.html
routine.json
routine-nfe.json
requirements.txt
sync_faculty.py
sync_routines.py
assets/app.js
assets/styles.css
assets/teachers.json
assets/official-faculty.json
assets/official-faculty-nfe.json
assets/cse-logo.png
assets/nfe-logo.jpg
.github/workflows/sync-routine.yml
```

If the workflow file is missing, use **Add file -> Create new file** and enter
this exact filename:

```text
.github/workflows/sync-routine.yml
```

Then paste the workflow file's contents and commit it to `main`.

### 2. Enable GitHub Pages

1. Open the repository's **Settings**.
2. Select **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/ (root)**.
5. Click **Save**.
6. Wait for **Actions -> pages-build-deployment** to show a green check.

For this repository, the expected website address is:

```text
https://90xexe.github.io/Class_Routine/
```

GitHub Pages serves `index.html` directly. `app.py` is only the convenient local
launcher and is not required by GitHub Pages.

## Enable automatic CSE and NFE sync

The included GitHub Action signs in with one CSE student account and one NFE
student account. It verifies the returned program name before publishing, scans
every semester/section combination and updates `routine.json` plus
`routine-nfe.json`. The same run updates both public faculty directories. It runs
automatically every six hours.

### 1. Add the four login secrets

Open **Settings -> Secrets and variables -> Actions** and create these repository
secrets exactly as written:

- `CSE_VU_STUDENT_ROLL`
- `CSE_VU_STUDENT_PASSWORD`
- `NFE_VU_STUDENT_ROLL`
- `NFE_VU_STUDENT_PASSWORD`

Use a CSE student account for the first pair and an NFE student account for the
second pair. Never write credentials inside a source file or workflow file.

### 2. Allow the workflow to update data

1. Open **Settings -> Actions -> General**.
2. Find **Workflow permissions**.
3. Select **Read and write permissions**.
4. Click **Save**.

### 3. Run the first sync

1. Upload every changed file, including `routine-nfe.json`, the NFE logo and the
   two NFE faculty/routine files.
2. Open the repository's **Actions** tab.
3. Select **Sync official routines** on the left.
4. Click **Run workflow**, keep branch **main**, then confirm the green button.

The first run checks both departments and can take roughly 6-10 minutes. A green
check means both account/program validations and both complete scans succeeded.
The Action commits changed JSON files and GitHub Pages deploys them automatically.

## Sync manually

Install the dependency, then run each department separately. The script prompts
for the matching student ID and password without storing or printing them.

```bash
python -m pip install -r requirements.txt
python sync_faculty.py
python sync_routines.py
```

For NFE, set `VU_DEPARTMENT=nfe`, `VU_ROUTINE_DESTINATION=routine-nfe.json` and
`VU_EXPECTED_PROGRAM=Nutrition and Food Engineering` before running
`sync_routines.py`. The GitHub Action already configures these values correctly.
## Updating the website later

1. Edit the project files locally.
2. Test them with `python app.py`.
3. Upload or push only the changed files to the `main` branch.
4. Wait for the Pages deployment to finish.
5. Hard-refresh the published website with `Ctrl+F5` if an older cached version
   is still visible.

## Data coverage

Coverage is reported separately for the selected department. Only semesters and
sections with a published routine appear. Classroom availability is calculated
only after the selected department's full scan succeeds, so CSE and NFE data are
never mixed or presented as each other.
## Security note

The official VU portal currently uses plain HTTP rather than HTTPS. GitHub
Secrets protect credentials from appearing in the repository and normal logs,
but the connection to the portal itself is not encrypted. Use a dedicated
account if one is available, or run the sync manually.

---

Developed by [Md. Nazim Uddin Noyon](https://github.com/90xExe)  
33rd Batch · [@90xExe](https://github.com/90xExe)

## Live class and break countdown

The day view now updates every second. While a class is running, its card shows the remaining time as `MM:SS left` (or `HH:MM:SS left` for longer periods). During generated break/free periods, the break row shows the same live countdown. When the timer reaches zero, the class/break status automatically transitions without a page refresh. The timer uses the routine timezone (`Asia/Dhaka` for the current data).

