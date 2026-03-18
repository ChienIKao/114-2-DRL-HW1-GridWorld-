# HW1 — GridWorld

A Flask web application implementing a configurable n×n GridWorld with random policy generation and iterative policy evaluation.

## Features

### HW1-1: Grid Map

- Generate an **n×n** grid (n = 5–9)
- Click to set the **Start** cell (green) and **End/Goal** cell (red)
- Place up to **n−2 obstacles** (gray); clicking an existing obstacle removes it

### HW1-2: Policy & Value Evaluation

- **Generate Random Policy**: assigns a random action (↑ ↓ ← →) to every non-special cell
- **Evaluate Policy**: runs iterative policy evaluation (Bellman equations, γ=0.9) to compute V(s) for each state; values are shown in each cell with a heat-map overlay

### HW1-3: Value Iteration & Optimal Policy

- **Value Iteration**: computes the optimal value function V*(s) and derives the optimal policy π*(s)
- The optimal policy arrows replace the random ones; values update accordingly
- The **optimal path** from Start to Goal is traced and highlighted in green

## Project Structure

```text
hw1_gridworld/
├── src/
│   ├── app.py              # Flask application & policy evaluation logic
│   ├── templates/
│   │   └── index.html      # Single-page UI
│   └── static/
│       ├── style.css       # Styles
│       └── script.js       # Frontend logic
├── requirements.txt
└── README.md
```

## Local Development

```bash
pip install -r requirements.txt
python src/app.py
# open http://127.0.0.1:5000
```

## Deploy to Vercel

```bash
npm i -g vercel   # install Vercel CLI (one-time)
vercel            # follow the prompts — deploy in ~30 s
```

The `vercel.json` at the repo root handles all routing to the Flask WSGI app automatically.

## Usage

1. Enter a grid size (5–9) and click **Generate Grid**.
2. Click **Set Start**, then click a cell → turns green.
3. Click **Set End**, then click a cell → turns red.
4. Click **Set Obstacle**, then click cells → turns gray (up to n−2; click again to remove).
5. Click **Generate Random Policy** → arrows appear in each cell.
6. Click **Evaluate Policy** → V(s) values appear with a colour heat-map (random policy).
7. Click **Value Iteration** → optimal arrows + V*(s) computed; optimal path highlighted green.
8. **Reset** clears all configuration while keeping the grid size.

## Algorithm

**Iterative Policy Evaluation** (Sutton & Barto, Ch. 4):

```text
Initialise V(s) = 0 for all s
Repeat:
    Δ = 0
    For each non-terminal state s:
        v ← V(s)
        V(s) ← R + γ · V(π(s))     # R = −1, γ = 0.9
        Δ ← max(Δ, |v − V(s)|)
Until Δ < θ (θ = 1e-6)
```

- **Reward**: −1 per step
- **Discount factor γ**: 0.9
- **Terminal state**: the End cell (V = 0)
- **Wall / obstacle hits**: agent stays in place

**Value Iteration** (Sutton & Barto, Ch. 4):

```text
Initialise V(s) = 0 for all s
Repeat:
    Δ = 0
    For each non-terminal state s:
        v ← V(s)
        V(s) ← max_a [R + γ · V(T(s,a))]
        Δ ← max(Δ, |v − V(s)|)
Until Δ < θ

π*(s) = argmax_a [R + γ · V*(T(s,a))]
```
