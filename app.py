from flask import Flask, request, jsonify
import json

app = Flask(__name__)

USERS_FILE = "users.json"


def load_users():
    with open(USERS_FILE, "r") as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=4)


@app.route("/users", methods=["GET"])
def get_users():
    return jsonify(load_users())


@app.route("/register", methods=["POST"])
def register_user():
    data = request.json
    users = load_users()

    # Verificar si ya existe
    if any(u["username"] == data["username"] for u in users):
        return jsonify({"error": "Usuario ya existe"}), 400

    users.append({
        "username": data["username"],
        "password": data["password"],  #más adelante lo vamos a hashear
        "role": data.get("role", "user")
    })
    save_users(users)
    return jsonify({"message": "Usuario registrado"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.json
    users = load_users()

    user = next((u for u in users if u["username"] == data["username"] and u["password"] == data["password"]), None)

    if not user:
        return jsonify({"error": "Credenciales inválidas"}), 401

    return jsonify({"message": "Login exitoso", "role": user["role"]})


if __name__ == "__main__":
    app.run(debug=True)
