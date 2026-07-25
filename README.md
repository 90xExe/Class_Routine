# VU CSE Routine Workspace

A mobile- and desktop-friendly routine website for Varendra University CSE
students and teachers. It also provides teacher schedules, classroom occupancy,
free-room checks and a complete weekly routine.

## Features

- **Student view:** select a semester and section, then view the selected day or
  the full weekly routine.
- Only semesters and sections with a published routine appear in the selectors.
- **Live class status:** today's classes automatically show `UPCOMING`,
  `RUNNING` or `ENDED` using Bangladesh time.
- **Teacher view:** type a teacher's name to see their courses, rooms, sections
  and class times.
- **Classroom explorer:** type a room number to see occupied and available slots
  after cross-checking every published routine.
- Free periods and breaks are shown with their start time, end time and duration.
- Off days are clearly marked in red.
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
4. Choose a date from the calendar, or use the left/right arrows.
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
requirements.txt
sync_routines.py
assets/app.js
assets/styles.css
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

## Enable automatic routine sync

The included GitHub Action signs in to the official student portal, checks every
semester/section combination and updates `routine.json` when an official routine
changes. It runs automatically every six hours.

### 1. Add login secrets

In the GitHub repository:

1. Open **Settings -> Secrets and variables -> Actions**.
2. Click **New repository secret**.
3. Add `VU_STUDENT_ROLL` and use the student ID/roll as its value.
4. Add another secret named `VU_STUDENT_PASSWORD` and use the portal password as
   its value.

Never write these values directly inside a source file or workflow file.

### 2. Allow the workflow to update data

1. Open **Settings -> Actions -> General**.
2. Find **Workflow permissions**.
3. Select **Read and write permissions**.
4. Click **Save**.

### 3. Run the first sync

1. Open the repository's **Actions** tab.
2. Select **Sync official routine** on the left.
3. Click **Run workflow**.
4. Keep branch **main** selected and click the green **Run workflow** button.

The scan checks 240 official combinations, so it normally takes about 3-5
minutes. A green check means the sync completed. When data changes, the workflow
commits the new `routine.json`, after which GitHub Pages deploys the updated site.

## Sync manually

To update the data from your own computer instead of storing GitHub Secrets:

```bash
python -m pip install -r requirements.txt
python sync_routines.py
```

The script asks for the student ID and password without saving or printing them.
After a successful sync, upload the changed `routine.json` to GitHub.

## Updating the website later

1. Edit the project files locally.
2. Test them with `python app.py`.
3. Upload or push only the changed files to the `main` branch.
4. Wait for the Pages deployment to finish.
5. Hard-refresh the published website with `Ctrl+F5` if an older cached version
   is still visible.

## Data coverage

The current data was created by checking 12 semesters and sections A through T:
240 possible combinations in total. The interface keeps only the 38 published
routines visible, representing 8 semesters, 75 teachers, 40 rooms and 545 class
entries. Empty semester/section combinations are not shown to users.

## Security note

The official VU portal currently uses plain HTTP rather than HTTPS. GitHub
Secrets protect credentials from appearing in the repository and normal logs,
but the connection to the portal itself is not encrypted. Use a dedicated
account if one is available, or run the sync manually.

---

Developed by [Md. Nazim Uddin Noyon](https://github.com/90xExe)  
33rd Batch · [@90xExe](https://github.com/90xExe)
