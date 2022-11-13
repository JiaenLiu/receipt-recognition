module.exports = function override(config, env) {
    console.log("React app rewired works!")
    config.resolve.fallback = {
        crypto: false,
        path: false,
        fs: false
    };
    return config;
};
