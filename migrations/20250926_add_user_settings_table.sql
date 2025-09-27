CREATE TABLE user_settings (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page_size integer NOT NULL DEFAULT 15 CHECK (page_size BETWEEN 1 AND 500),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_user_settings_user ON user_settings(user_id);
