export class ErrorHandler extends Error {
    constructor(statusCode, message) {
        super();
        this.statusCode = statusCode;
        this.message = message;
    }
}

export const handleError = (error, response) => {
    consola.info(error);
    const { statusCode, message } = error;
    response.status(statusCode).json({
        status: 'error',
        success: false,
        statusCode,
        message,
    });
};
