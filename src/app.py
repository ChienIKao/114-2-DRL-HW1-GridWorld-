from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__)

ACTIONS = ['up', 'down', 'left', 'right']


def get_next_state(state, action, n, obstacles_set):
    """Return next state given current state and action (with boundary/obstacle handling)."""
    r, c = state
    moves = {'up': (-1, 0), 'down': (1, 0), 'left': (0, -1), 'right': (0, 1)}
    dr, dc = moves[action]
    nr, nc = r + dr, c + dc

    if 0 <= nr < n and 0 <= nc < n and (nr, nc) not in obstacles_set:
        return (nr, nc)
    return state  # Stay in place if blocked


def policy_evaluation(n, goal, obstacles, policy, gamma=0.9, theta=1e-6, max_iter=10000):
    """
    Iterative policy evaluation.

    Args:
        n: grid size
        goal: (row, col) of terminal state
        obstacles: list of [row, col] obstacle positions
        policy: dict mapping "row,col" -> action string
        gamma: discount factor
        theta: convergence threshold
        max_iter: maximum iterations

    Returns:
        dict mapping "row,col" -> V(s) value
    """
    obstacles_set = set(tuple(o) for o in obstacles)
    goal_t = tuple(goal)

    # Initialize V(s) = 0 for all reachable states
    V = {}
    for r in range(n):
        for c in range(n):
            state = (r, c)
            if state not in obstacles_set:
                V[state] = 0.0

    # Iterative policy evaluation
    for _ in range(max_iter):
        delta = 0.0
        for r in range(n):
            for c in range(n):
                state = (r, c)
                if state in obstacles_set or state == goal_t:
                    continue

                key = f"{r},{c}"
                action = policy.get(key)
                if action is None:
                    continue

                next_state = get_next_state(state, action, n, obstacles_set)
                reward = -1.0
                new_v = reward + gamma * V.get(next_state, 0.0)

                delta = max(delta, abs(new_v - V[state]))
                V[state] = new_v

        if delta < theta:
            break

    # Serialize
    result = {}
    for state, value in V.items():
        result[f"{state[0]},{state[1]}"] = round(value, 3)

    return result


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/generate_policy', methods=['POST'])
def generate_policy():
    data = request.json
    n = int(data['n'])
    obstacles = data.get('obstacles', [])
    goal = data.get('goal')

    obstacles_set = set(tuple(o) for o in obstacles)
    goal_t = tuple(goal) if goal else None

    policy = {}
    for r in range(n):
        for c in range(n):
            state = (r, c)
            if state in obstacles_set:
                continue
            if goal_t and state == goal_t:
                continue
            policy[f"{r},{c}"] = random.choice(ACTIONS)

    return jsonify({'policy': policy})


@app.route('/evaluate', methods=['POST'])
def evaluate():
    data = request.json
    n = int(data['n'])
    goal = data['goal']
    obstacles = data.get('obstacles', [])
    policy = data['policy']

    values = policy_evaluation(n, goal, obstacles, policy)
    return jsonify({'values': values})


def value_iteration(n, goal, obstacles, gamma=0.9, theta=1e-6, max_iter=10000):
    """
    Value iteration to find optimal policy and value function.

    Returns:
        values: dict "row,col" -> V*(s)
        policy: dict "row,col" -> optimal action
    """
    obstacles_set = set(tuple(o) for o in obstacles)
    goal_t = tuple(goal)

    V = {(r, c): 0.0
         for r in range(n) for c in range(n)
         if (r, c) not in obstacles_set}

    for _ in range(max_iter):
        delta = 0.0
        for r in range(n):
            for c in range(n):
                state = (r, c)
                if state in obstacles_set or state == goal_t:
                    continue

                best = float('-inf')
                for action in ACTIONS:
                    ns = get_next_state(state, action, n, obstacles_set)
                    q = -1.0 + gamma * V.get(ns, 0.0)
                    if q > best:
                        best = q

                delta = max(delta, abs(best - V[state]))
                V[state] = best

        if delta < theta:
            break

    # Extract optimal policy
    policy = {}
    for r in range(n):
        for c in range(n):
            state = (r, c)
            if state in obstacles_set or state == goal_t:
                continue
            best_action, best_q = None, float('-inf')
            for action in ACTIONS:
                ns = get_next_state(state, action, n, obstacles_set)
                q = -1.0 + gamma * V.get(ns, 0.0)
                if q > best_q:
                    best_q, best_action = q, action
            policy[f"{r},{c}"] = best_action

    values = {f"{r},{c}": round(V[(r, c)], 3)
              for r in range(n) for c in range(n)
              if (r, c) not in obstacles_set}

    return values, policy


def trace_path(start, goal, policy, n, obstacles):
    """Follow optimal policy from start to goal; return list of [r,c]."""
    obstacles_set = set(tuple(o) for o in obstacles)
    goal_t = tuple(goal)
    path = []
    current = tuple(start)
    visited = set()

    while current != goal_t and len(path) < n * n:
        if current in visited:
            break  # cycle — no path to goal
        visited.add(current)
        path.append(list(current))
        action = policy.get(f"{current[0]},{current[1]}")
        if action is None:
            break
        current = get_next_state(current, action, n, obstacles_set)

    path.append(list(goal_t))  # include goal
    return path


@app.route('/value_iteration', methods=['POST'])
def run_value_iteration():
    data = request.json
    n = int(data['n'])
    goal = data['goal']
    start = data['start']
    obstacles = data.get('obstacles', [])

    values, policy = value_iteration(n, goal, obstacles)
    path = trace_path(start, goal, policy, n, obstacles)
    return jsonify({'values': values, 'policy': policy, 'path': path})


if __name__ == '__main__':
    app.run(debug=True)
