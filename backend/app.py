import os
from datetime import timedelta, datetime

from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import func, text

# ---------- config ----------
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://tomsk_app:JSueaOR_zaX@localhost:5432/tomsk"
)
JWT_SECRET = os.getenv("JWT_SECRET", "replace-this-secret")
ACCESS_EXPIRES_MINUTES = int(os.getenv("ACCESS_EXPIRES_MINUTES", "60"))

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = JWT_SECRET
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(minutes=ACCESS_EXPIRES_MINUTES)

db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

# ---------- models ----------
class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.Text)
    email = db.Column(db.Text, unique=True)
    password_hash = db.Column(db.Text)
    role = db.Column(db.Text, default="site_user")
    avatar_url = db.Column(db.Text, default="/static/img/default-avatar.png")
    created_at = db.Column(db.DateTime, server_default=func.now())

    def to_public(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "avatar_url": self.avatar_url,
            "role": self.role,
        }

class Article(db.Model):
    __tablename__ = "articles"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.Text, nullable=False)
    slug = db.Column(db.Text, nullable=False, unique=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    body = db.Column(db.Text, nullable=False)
    rating = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_summary(self):
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "rating": self.rating or 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "body": (self.body or "")[:300]
        }

    def to_full(self):
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "rating": self.rating or 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "body": self.body
        }

class Comment(db.Model):
    __tablename__ = "comments"
    id = db.Column(db.Integer, primary_key=True)
    article_id = db.Column(db.Integer, db.ForeignKey("articles.id", ondelete="CASCADE"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"))
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

class ArticleRating(db.Model):
    __tablename__ = "article_ratings"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    article_id = db.Column(db.Integer, db.ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    value = db.Column(db.Integer, nullable=False)  # -1 or 1
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        db.UniqueConstraint('user_id', 'article_id', name='article_ratings_user_article_key'),
    )

# ---------- helpers ----------
def current_user_or_401():
    identity = get_jwt_identity()
    if not identity:
        return None
    return User.query.get(identity)

# ---------- root для проверки ----------
@app.route("/")
def root():
    return jsonify({"msg": "Server is running"}), 200

# ---------- auth routes ----------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    if not username or not email or not password:
        return jsonify({"msg": "username, email and password required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "email already registered"}), 400

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        avatar_url=data.get("avatar_url") or "/static/img/default-avatar.png",
        role="site_user"
    )
    db.session.add(user)
    db.session.commit()

    access = create_access_token(identity=user.id)
    return jsonify({"access_token": access, "user": user.to_public()}), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return jsonify({"msg": "email and password required"}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash or "", password):
        return jsonify({"msg": "invalid credentials"}), 401
    token = create_access_token(identity=user.id)
    return jsonify({"access_token": token, "user": user.to_public()}), 200

# ---------- articles ----------
@app.route("/api/articles", methods=["GET"])
def list_articles():
    q = Article.query.order_by(Article.rating.desc(), Article.created_at.desc()).limit(100)
    return jsonify([a.to_summary() for a in q.all()]), 200

@app.route("/api/articles/<int:article_id>", methods=["GET"])
def get_article(article_id):
    a = Article.query.get_or_404(article_id)
    return jsonify(a.to_full()), 200

# ---------- comments ----------
@app.route("/api/articles/<int:article_id>/comments", methods=["GET"])
def get_comments(article_id):
    sql = text("""
        SELECT c.id, c.body, c.created_at, u.id AS user_id, u.username, u.avatar_url
        FROM comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.article_id = :aid
        ORDER BY c.created_at ASC
    """)
    rows = db.session.execute(sql, {"aid": article_id}).fetchall()
    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "body": r.body,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "user": {
                "id": r.user_id,
                "username": r.username,
                "avatar_url": r.avatar_url
            }
        })
    return jsonify(out), 200

@app.route("/api/articles/<int:article_id>/comments", methods=["POST"])
@jwt_required()
def post_comment(article_id):
    user = current_user_or_401()
    if not user:
        return jsonify({"msg": "auth required"}), 401
    data = request.get_json() or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"msg": "empty comment"}), 400

    article = Article.query.get(article_id)
    if not article:
        return jsonify({"msg": "article not found"}), 404

    comment = Comment(article_id=article_id, user_id=user.id, body=body)
    db.session.add(comment)
    db.session.commit()

    return jsonify({
        "id": comment.id,
        "body": comment.body,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "user": {
            "id": user.id,
            "username": user.username,
            "avatar_url": user.avatar_url
        }
    }), 201

# ---------- rating ----------
@app.route("/api/articles/<int:article_id>/rate", methods=["POST"])
@jwt_required()
def rate_article(article_id):
    user = current_user_or_401()
    if not user:
        return jsonify({"msg": "auth required"}), 401

    data = request.get_json() or {}
    try:
        val = int(data.get("value"))
    except:
        return jsonify({"msg": "value must be 1 or -1"}), 400
    if val not in (1, -1):
        return jsonify({"msg": "value must be 1 or -1"}), 400

    article = Article.query.get(article_id)
    if not article:
        return jsonify({"msg": "article not found"}), 404

    sql = text("""
    INSERT INTO article_ratings (user_id, article_id, value, created_at)
    VALUES (:uid, :aid, :val, now())
    ON CONFLICT (user_id, article_id) DO UPDATE
      SET value = EXCLUDED.value, created_at = now()
    RETURNING id;
    """)
    db.session.execute(sql, {"uid": user.id, "aid": article_id, "val": val})
    db.session.commit()

    total = db.session.query(func.coalesce(func.sum(ArticleRating.value), 0))\
        .filter(ArticleRating.article_id == article_id).scalar()
    article.rating = int(total or 0)
    article.updated_at = datetime.utcnow()
    db.session.add(article)
    db.session.commit()

    return jsonify({"new_rating": article.rating}), 200

# ---------- whoami ----------
@app.route("/api/whoami", methods=["GET"])
@jwt_required(optional=True)
def whoami():
    identity = get_jwt_identity()
    if not identity:
        return jsonify({"user": None}), 200
    user = User.query.get(identity)
    if not user:
        return jsonify({"user": None}), 200
    return jsonify({"user": user.to_public()}), 200

# ---------- run ----------
if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=(os.getenv("FLASK_DEBUG","0")=="1")
    )
