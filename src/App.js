import './App.css';
import React from "react";
import cv from "@techstark/opencv-js";

function App() {
  const [text, setText] = React.useState('');
  const [warning, setWarning] = React.useState('');
  const [inputImg, setInputImg] = React.useState('');
  const [contourImgs, setContourImgs] = React.useState([]);

  const onChangeFile = (e) => {
    const file = e.target.files?.[0];

    const acceptedImageTypes = ['image/gif', 'image/jpeg', 'image/png'];
    if (!file || !acceptedImageTypes.includes(file['type'])) {
      setWarning('Please upload a valid image file!');
      return;
    }
    setWarning('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = e.target.result
      setInputImg(img);
      try {
        const img = cv.imread(img);
        setContourImgs(getContours(img))
        img.delete();
      } catch (error) {
        console.log(error);
      }
    }
    reader.readAsDataURL(file);
  }

  return (
    <div className="App">
      <h2>Receipt Detection</h2>
      <input type="file" onChange={onChangeFile} />
      {
        warning && <p style={{ color: 'red' }}>{warning}</p>
      }
      {
        inputImg && <img style={{ width: '200px' }} alt="input" />
      }
      {
        contourImgs.map((img, i) => (
          <img key={i} src={img} alt={"contour"+i} />
        ))
      }
      {
        text && <p>{text}</p>
      }
    </div>
  );
}

export default App;
