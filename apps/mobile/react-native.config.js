// onnxruntime-react-native isn't picked up by autolinking (it ships a legacy unimodule.json), so register it here.
module.exports = {
  dependencies: {
    "onnxruntime-react-native": {
      platforms: {
        android: {
          packageImportPath: "import ai.onnxruntime.reactnative.OnnxruntimePackage;",
          packageInstance: "new OnnxruntimePackage()",
        },
      },
    },
  },
};
