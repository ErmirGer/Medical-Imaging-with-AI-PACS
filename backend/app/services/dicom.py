"""PNG -> DICOM (Secondary Capture) + push to Orthanc via POST /instances."""
from __future__ import annotations

import datetime
import io

import httpx
import numpy as np
import pydicom
import skimage.io
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import (
    ExplicitVRLittleEndian,
    SecondaryCaptureImageStorage,
    generate_uid,
)


def png_to_dicom_bytes(
    path: str,
    patient_name: str,
    patient_id: str,
    study_uid: str | None = None,
) -> tuple[bytes, str]:
    arr = skimage.io.imread(path)
    if arr.ndim == 3:
        arr = arr[..., :3].mean(2)
    arr = ((arr - arr.min()) / (np.ptp(arr) + 1e-8) * 255).astype(np.uint8)

    fm = FileMetaDataset()
    fm.MediaStorageSOPClassUID = SecondaryCaptureImageStorage
    fm.MediaStorageSOPInstanceUID = generate_uid()
    fm.TransferSyntaxUID = ExplicitVRLittleEndian

    ds = FileDataset(None, {}, file_meta=fm, preamble=b"\0" * 128)
    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.StudyInstanceUID = study_uid or generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.SOPInstanceUID = fm.MediaStorageSOPInstanceUID
    ds.SOPClassUID = SecondaryCaptureImageStorage
    ds.Modality = "DX"
    ds.StudyDate = datetime.date.today().strftime("%Y%m%d")
    ds.SeriesDescription = "RadGuard CXR"
    ds.Rows, ds.Columns = arr.shape
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.PixelRepresentation = 0
    ds.PixelData = arr.tobytes()
    ds.is_little_endian = True
    ds.is_implicit_VR = False

    buf = io.BytesIO()
    ds.save_as(buf, write_like_original=False)
    return buf.getvalue(), str(ds.StudyInstanceUID)


def push_to_orthanc(dicom_bytes: bytes, orthanc_url: str) -> dict:
    r = httpx.post(
        f"{orthanc_url}/instances",
        content=dicom_bytes,
        headers={"content-type": "application/dicom"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()  # {"ID":..., "ParentStudy":..., "Status":"Success"}
