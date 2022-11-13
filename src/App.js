import './App.css';
import React from "react";
import { getContoursFromBase64, readImgFromBase64 } from './utils';

const IMG_WIDTH = 300

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
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      setInputImg(e.target.result);
      setContourImgs(getContoursFromBase64(e.target.result, IMG_WIDTH))
    }

    reader.onerror = (error) => {
      setWarning(error);
      console.log(error);
    }
  }

  return (
    <div className="App">
      <h2>Receipt Detection</h2>
      <input type="file" onChange={onChangeFile} />
      {
        warning && <p style={{ color: 'red' }}>{warning}</p>
      }
      <br></br>
      {
        inputImg && <>
          <p>Input image (+ preprocess steps)</p>
          <img style={{ width: IMG_WIDTH + 'px' }} src={inputImg} alt="input" />
        </>
      }
      {
        contourImgs?.[0]?.map?.((img, i) => (
          <img style={{ maxWidth: IMG_WIDTH + 'px' }} key={i} src={img} alt={"step"+(i)} />
        ))
      }
      <br></br>
      {
        contourImgs?.[1]?.length > 0 ? <>
          <p>Found contours</p>
          {
            contourImgs?.[1]?.map?.((img, i) => (
              <img style={{ maxWidth: IMG_WIDTH + 'px' }} key={i} src={img} alt={"contour"+(i)} />
            ))
          }
        </> : <p>No contour detected</p>
      }
      {
        text && <p>{text}</p>
      }
    </div>
  );
}

export default App;
