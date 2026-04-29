import onnxruntime as ort
import numpy as np

model_path = "public/models/demucs.onnx"

try:
    session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    print("MODEL LOADED SUCCESSFULLY")

    print("Inputs:", [i.name for i in session.get_inputs()])
    print("Outputs:", [o.name for o in session.get_outputs()])

except Exception as e:
    print("MODEL FAILED TO LOAD")
    print(e)