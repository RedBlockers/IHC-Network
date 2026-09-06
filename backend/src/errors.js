"use strict";

class AppError extends Error {
    constructor(message, { status = 500, code = "internal_error", details, cause, expose } = {}) {
        super(message, { cause });
        this.name = new.target.name;
        this.status = status;
        this.code = code;
        this.details = details;
        this.expose = expose ?? (status < 500 || status === 503 || status === 507);
        Error.captureStackTrace?.(this, new.target);
    }
}

class BadRequest extends AppError {
    constructor(message = "Requête invalide.", options = {}) {
        super(message, { status: 400, code: "bad_request", ...options });
    }
}

class Unauthorized extends AppError {
    constructor(message = "Authentification requise.", options = {}) {
        super(message, { status: 401, code: "unauthorized", ...options });
    }
}

class Forbidden extends AppError {
    constructor(message = "Accès refusé.", options = {}) {
        super(message, { status: 403, code: "forbidden", ...options });
    }
}

class NotFound extends AppError {
    constructor(message = "Ressource introuvable.", options = {}) {
        super(message, { status: 404, code: "not_found", ...options });
    }
}

class Conflict extends AppError {
    constructor(message = "Conflit avec l'état actuel de la ressource.", options = {}) {
        super(message, { status: 409, code: "conflict", ...options });
    }
}

class PayloadTooLarge extends AppError {
    constructor(message = "Contenu trop volumineux.", options = {}) {
        super(message, { status: 413, code: "payload_too_large", ...options });
    }
}

class UnsupportedMedia extends AppError {
    constructor(message = "Format de fichier non pris en charge.", options = {}) {
        super(message, { status: 415, code: "unsupported_media_type", ...options });
    }
}

class TooManyRequests extends AppError {
    constructor(message = "Trop de requêtes. Réessayez plus tard.", options = {}) {
        super(message, { status: 429, code: "too_many_requests", ...options });
    }
}

class InsufficientStorage extends AppError {
    constructor(message = "Stockage plein.", options = {}) {
        super(message, { status: 507, code: "insufficient_storage", ...options });
    }
}

class ServiceUnavailable extends AppError {
    constructor(message = "Service temporairement indisponible.", options = {}) {
        super(message, { status: 503, code: "service_unavailable", ...options });
    }
}

const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    PayloadTooLarge,
    UnsupportedMedia,
    TooManyRequests,
    InsufficientStorage,
    ServiceUnavailable,
    asyncHandler,
};
