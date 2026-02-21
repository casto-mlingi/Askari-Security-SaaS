import React, { useState, useEffect } from 'react';
import { EducationRecord, Guard, ApplicationStatus, UserRole, Guarantor, SecurityTraining } from '../types';
import FileUploader from './FileUploader';
import { guardService } from '../services/guardService';
import { api } from '../services/api';

interface WizardData {
  full_name: string;
  nida_number: string;
  phone: string;
  dob: string;
  gender: 'male' | 'female' | 'trans' | '';
  application_letter_url: string;
  nida_front_url: string;
  birth_cert_url: string;
  medical_report_url?: string;
  police_clearance_url: string;
  cv_url: string;
  passport_photo_url: string;
  guarantors: Guarantor[];
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
  residence_lat?: number;
  residence_lng?: number;
  residence_letter_url: string;
  education_records: EducationRecord[];
  is_armed: boolean;
  bank_account_number?: string;
  previous_experience: boolean;
  nssf_number?: string;
  previous_employer_letter_url?: string;
  physical_address?: string;
  street?: string;
  ward?: string;
  district?: string;
  emergency_contact?: string;
  uniform_shirt_size?: string;
  uniform_boot_size?: string;
}

type ValidationErrors = {
  [key in keyof WizardData | string]?: string;
};

const SectionHeader: React.FC<{ number: string; title: string; }> = ({ number, title }) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center font-black text-lg shadow-lg">
      {number}
    </div>
    <div>
      <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter">{title}</h3>
      <div className="h-0.5 w-16 bg-primary mt-1" />
    </div>
  </div>
);

const InputField: React.FC<{
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    error?: string;
    type?: string;
    placeholder?: string;
    className?: string;
    rightElement?: React.ReactNode;
    disabled?: boolean;
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}> = ({ label, name, value, onChange, error, type = 'text', placeholder, className, rightElement, disabled, onBlur }) => (
    <div className={`space-y-2 ${className}`}>
        <div className="flex justify-between items-end">
            <label htmlFor={name} className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{label}</label>
            {rightElement}
        </div>
        <input
            id={name}
            name={name}
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={!!disabled}
            className={`w-full h-14 px-6 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none transition-all ${error ? 'border-red-300' : 'border-slate-100 focus:border-primary'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
        {error && <p className="text-xs font-medium text-red-500 mt-1 ml-2">{error}</p>}
    </div>
);

const STORAGE_KEY_PREFIX = 'amini_guard_wizard_draft_';

export const GuardWizard: React.FC<{ guards: Guard[], userRole: UserRole, initialData?: Partial<Guard>, onComplete: (guard: Guard, isApplicantFlow?: boolean) => void, isApplicantFlow?: boolean, isReadOnly?: boolean }> = ({ initialData, onComplete, isApplicantFlow = false, isReadOnly: readOnlyProp, userRole }) => {
  const STORAGE_KEY = initialData?.id ? `${STORAGE_KEY_PREFIX}${initialData.id}` : STORAGE_KEY_PREFIX + 'new';
  
  const mapGuardToWizardData = (g: Partial<Guard>): WizardData => {
    const dd = (g as any)?.dossier_data || {};
    const guars = Array.isArray(g.guarantors) ? g.guarantors : [];
    const edus = Array.isArray(g.education_history) ? g.education_history : [];
    return {
      full_name: g.full_name || '',
      nida_number: g.nida_number || '',
      phone: g.phone || '',
      dob: g.dob || '',
      gender: (g as any)?.gender || '',
      application_letter_url: g.application_letter_url || '',
      nida_front_url: g.nida_front_url || '',
      birth_cert_url: g.birth_cert_url || '',
      medical_report_url: (g as any)?.medical_report_url || '',
      police_clearance_url: g.police_clearance_url || '',
      cv_url: g.cv_url || '',
      passport_photo_url: (g as any)?.passport_photo_url || '',
      guarantors: guars as Guarantor[],
      next_of_kin_name: (g as any)?.kin_name || g.next_of_kin_name || '',
      next_of_kin_phone: (g as any)?.kin_phone || g.next_of_kin_phone || '',
      next_of_kin_relationship: (g as any)?.kin_relationship || g.next_of_kin_relationship || '',
      residence_letter_url: g.residence_letter_url || '',
      education_records: edus as EducationRecord[],
      is_armed: !!g.is_armed,
      residence_lat: g.residence_lat,
      residence_lng: g.residence_lng,
      bank_account_number: g.bank_account_number || '',
      previous_experience: !!(g as any)?.previous_experience,
      nssf_number: g.nssf_number || '',
      previous_employer_letter_url: (g as any)?.previous_employer_letter_url || '',
      physical_address: ((g as any)?.physical_address ?? dd.physical_address) || '',
      street: dd.street || '',
      ward: dd.ward || '',
      district: dd.district || '',
      emergency_contact: ((g as any)?.emergency_contact ?? dd.emergency_contact) || '',
      uniform_shirt_size: dd.uniform_shirt_size || '',
      uniform_boot_size: dd.uniform_boot_size || ''
    };
  };

  const initialFormState: WizardData = {
    full_name: initialData?.full_name || '',
    nida_number: initialData?.nida_number || '',
    phone: initialData?.phone || '',
    dob: initialData?.dob || '',
    gender: (initialData as any)?.gender || '',
    application_letter_url: initialData?.application_letter_url || '',
    nida_front_url: initialData?.nida_front_url || '',
    birth_cert_url: initialData?.birth_cert_url || '',
    medical_report_url: (initialData as any)?.medical_report_url || '',
    police_clearance_url: initialData?.police_clearance_url || '',
    cv_url: initialData?.cv_url || '',
    passport_photo_url: (initialData as any)?.passport_photo_url || '',
    guarantors: initialData?.guarantors || [],
    next_of_kin_name: initialData?.next_of_kin_name || '',
    next_of_kin_phone: initialData?.next_of_kin_phone || '',
    next_of_kin_relationship: initialData?.next_of_kin_relationship || '',
    residence_letter_url: initialData?.residence_letter_url || '',
    education_records: (initialData as any)?.education_records || initialData?.education_history || [],
    is_armed: initialData?.is_armed || false,
    residence_lat: initialData?.residence_lat,
    residence_lng: initialData?.residence_lng,
    bank_account_number: initialData?.bank_account_number || '',
    previous_experience: (initialData as any)?.previous_experience || false,
    nssf_number: initialData?.nssf_number || '',
    previous_employer_letter_url: (initialData as any)?.previous_employer_letter_url || '',
    physical_address: (initialData as any)?.physical_address || (initialData as any)?.dossier_data?.physical_address || '',
    street: (initialData as any)?.dossier_data?.street || '',
    ward: (initialData as any)?.dossier_data?.ward || '',
    district: (initialData as any)?.dossier_data?.district || '',
    emergency_contact: (initialData as any)?.emergency_contact || (initialData as any)?.dossier_data?.emergency_contact || '',
    uniform_shirt_size: (initialData as any)?.dossier_data?.uniform_shirt_size || '',
    uniform_boot_size: (initialData as any)?.dossier_data?.uniform_boot_size || '',
  };

  const [securityTraining, setSecurityTraining] = useState<SecurityTraining[]>(
    Array.isArray((initialData as any)?.dossier_data?.security_training)
      ? (initialData as any).dossier_data.security_training
      : (Array.isArray((initialData as any)?.security_training) ? (initialData as any).security_training : [])
  );
  
  
  

  useEffect(() => {
    try {
      const raw = localStorage.getItem('amini_pending_guard');
      if (!raw || !isApplicantFlow) return;
      const ap = JSON.parse(raw);
      const matchesNida = !!initialData?.nida_number && !!ap.nida_number && String(initialData?.nida_number).replace(/\D/g, '') === String(ap.nida_number).replace(/\D/g, '');
      const matchesName = !!initialData?.full_name && !!ap.full_name && String(initialData?.full_name).trim().toLowerCase() === String(ap.full_name).trim().toLowerCase();
      if (matchesNida || matchesName) {
        setFormData(prev => ({
          ...prev,
          full_name: prev.full_name || ap.full_name || '',
          nida_number: prev.nida_number || ap.nida_number || ''
        }));
        localStorage.removeItem('amini_pending_guard');
      }
    } catch {}
  }, [isApplicantFlow, initialData?.nida_number, initialData?.full_name]);

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<WizardData>(initialFormState);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [profileScore, setProfileScore] = useState(0);
  
  const statusValue = ((initialData as any)?.status || '') as string;
  const isLockedByStatus = !!statusValue && String(statusValue).toLowerCase() !== 'draft';
  const isLocked = !!readOnlyProp || isLockedByStatus || hasSubmitted;
  const isReadOnly = isLocked;

  const safeMergeWizardData = (prev: WizardData, next: Partial<WizardData>): WizardData => {
    const merged: any = { ...prev };
    Object.keys(next || {}).forEach((k) => {
      const val = (next as any)[k];
      if (val === undefined || val === null) return;
      if (typeof val === 'string') {
        if (val !== '') merged[k] = val;
        return;
      }
      if (Array.isArray(val)) {
        if (val.length > 0 || (prev as any)[k] === undefined) merged[k] = val;
        return;
      }
      merged[k] = val;
    });
    return merged as WizardData;
  };
  const isTZPhone = (v: string) => {
    const t = (v || '').trim();
    const digits = t.replace(/\D/g, '');
    const starts = t.startsWith('0') || t.startsWith('+255');
    const lenOk = digits.length >= 10 && digits.length <= 12;
    return !!t && starts && lenOk;
  };

  

  // NIDA auto-fill removed: manual inputs only

  const fieldError = (name: string, value: string): string | undefined => {
    if (name === 'full_name' || name === 'dob' || name === 'gender' || name === 'next_of_kin_name') {
      if (!value) return 'This field is required.';
    }
    if (name === 'phone' || name === 'next_of_kin_phone') {
      if (!value) return 'This field is required.';
      if (!isTZPhone(value)) return 'Please enter a valid Tanzanian phone number (e.g., 0755123456).';
    }
    if (name === 'physical_address' || name === 'emergency_contact') {
      if (!value) return 'This field is required.';
    }
    if (name === 'nida_number') {
      const clean = (value || '').replace(/\D/g, '');
      if (!value) return 'This field is required.';
      if (clean.length !== 20) return 'NIDA Number must be exactly 20 digits.';
    }
    if (name === 'nssf_number') {
      if (value && !/^\d+$/.test(value)) return 'NSSF Number must contain digits only.';
    }
    if (name === 'bank_account_number') {
      if (value && !/^\d+$/.test(value)) return 'Bank Account must be digits only.';
    }
    return undefined;
  };

  // Load draft from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, [STORAGE_KEY]);

  // Re-hydrate from database on mount if an ID exists
  useEffect(() => {
    const run = async () => {
      try {
        const id = initialData?.id ? String(initialData.id) : null;
        if (!id) return;
        const res = await guardService.getGuardById(id);
        if (res.data) {
          const wd = mapGuardToWizardData(res.data);
          setFormData(prev => safeMergeWizardData(prev, wd));
          setSecurityTraining(Array.isArray((res.data as any).security_training) ? (res.data as any).security_training : []);
        }
      } catch {}
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id]);

  // DOB remains manual input; no auto-derivation from NIDA

  useEffect(() => {
    let s = 0;
    s += formData.full_name ? 2 : 0;
    s += formData.phone ? 3 : 0;
    s += formData.dob ? 5 : 0;
    s += formData.nida_number ? 10 : 0;
    s += formData.nida_front_url ? 10 : 0;
    s += formData.police_clearance_url ? 10 : 0;
    s += formData.residence_letter_url ? 10 : 0;
    s += formData.cv_url ? 5 : 0;
    s += formData.application_letter_url ? 5 : 0;
    s += formData.next_of_kin_name ? 5 : 0;
    s += formData.next_of_kin_relationship ? 5 : 0;
    s += formData.next_of_kin_phone ? 5 : 0;
    s += formData.previous_experience ? 5 : 0;
    s += (formData.previous_experience && formData.nssf_number) ? 10 : 0;
    s += formData.bank_account_number ? 5 : 0;
    s += formData.education_records.length ? 5 : 0;
    s += formData.guarantors.length ? 5 : 0;
    setProfileScore(Math.min(100, s));
  }, [formData]);

  
  // Save draft on change
  useEffect(() => {
    if (!initialData) { 
        const timeoutId = setTimeout(() => {
            try {
                const dataToSave = { ...formData };
                const isHeavy = (s?: string) => s && s.length > 5000;

                // Strip heavy Base64 strings to avoid localStorage limits
                if (isHeavy(dataToSave.nida_front_url)) dataToSave.nida_front_url = '';
                if (isHeavy(dataToSave.birth_cert_url)) dataToSave.birth_cert_url = '';
                if (isHeavy(dataToSave.application_letter_url)) dataToSave.application_letter_url = '';
                if (isHeavy(dataToSave.residence_letter_url)) dataToSave.residence_letter_url = '';
                dataToSave.education_records = (dataToSave as any).education_records?.map((e: any) => ({
                    ...e, certificate_url: isHeavy(e.certificate_url) ? '' : e.certificate_url
                })) || [];
                dataToSave.guarantors = dataToSave.guarantors.map(g => ({
                    ...g,
                    intro_letter_url: isHeavy((g as any).intro_letter_url) ? '' : (g as any).intro_letter_url,
                    id_copy_url: isHeavy((g as any).id_copy_url) ? '' : (g as any).id_copy_url,
                    residence_letter_url: isHeavy((g as any).residence_letter_url) ? '' : (g as any).residence_letter_url
                }));

                localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
            } catch (e) {
                console.warn("LocalStorage quota exceeded, draft not saved.", e);
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }
  }, [formData, STORAGE_KEY, initialData]);

  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    const msg = fieldError(name, value);
    setErrors(prev => {
      const next = { ...prev };
      if (msg) next[name] = msg;
      else delete next[name];
      return next;
    });
  };

  const handleFileChange = (field: keyof WizardData, url: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
    if (errors[field as string]) {
      setErrors(prev => { const newErrors = { ...prev }; delete newErrors[field as string]; return newErrors; });
    }
    
  };

  const getAllErrors = (): ValidationErrors => {
    if (isReadOnly) return {};
    const newErrors: ValidationErrors = {};
    if (!formData.full_name) newErrors.full_name = 'This field is required.';
    const nidErr = fieldError('nida_number', formData.nida_number);
    if (nidErr) newErrors.nida_number = nidErr;
    const phErr = fieldError('phone', formData.phone);
    if (phErr) newErrors.phone = phErr;
    if (!formData.dob) newErrors.dob = 'This field is required.';
    if (!formData.gender) newErrors.gender = 'This field is required.';
    if (formData.nssf_number && fieldError('nssf_number', formData.nssf_number)) newErrors.nssf_number = 'NSSF Number must contain digits only.';
    if (formData.bank_account_number && fieldError('bank_account_number', formData.bank_account_number)) newErrors.bank_account_number = 'Bank Account must be digits only.';
    if (!formData.passport_photo_url) newErrors.passport_photo_url = 'This field is required.';
    if (!formData.nida_front_url) newErrors.nida_front_url = 'This field is required.';
    if (!formData.birth_cert_url) newErrors.birth_cert_url = 'This field is required.';
    if (!formData.application_letter_url) newErrors.application_letter_url = 'This field is required.';
    if (!formData.police_clearance_url) newErrors.police_clearance_url = 'This field is required.';
    if (!formData.cv_url) newErrors.cv_url = 'This field is required.';
    if (!formData.residence_letter_url) newErrors.residence_letter_url = 'This field is required.';
    formData.education_records.forEach((e, idx) => {
      const s = (e as any)?.start_date;
      const en = (e as any)?.end_date;
      if (s && en) {
        if (new Date(en).getTime() < new Date(s).getTime()) {
          newErrors[`edu_end_${idx}`] = 'End date cannot be before start date.';
        }
      }
    });
    if (!formData.next_of_kin_name) newErrors.next_of_kin_name = 'This field is required.';
    const kinPhErr = fieldError('next_of_kin_phone', formData.next_of_kin_phone);
    if (kinPhErr) newErrors.next_of_kin_phone = kinPhErr;
    if (!formData.next_of_kin_relationship) newErrors.next_of_kin_relationship = 'This field is required.';
    if (!formData.physical_address) newErrors.physical_address = 'This field is required.';
    if (!formData.emergency_contact) newErrors.emergency_contact = 'This field is required.';
    if (formData.guarantors.length < 2) {
      newErrors.guarantors = 'At least 2 guarantors are required';
    } else {
      formData.guarantors.forEach((g, idx) => {
        if (!g.name) newErrors[`g_name_${idx}`] = 'This field is required.';
        if (!g.relationship) newErrors[`g_rel_${idx}`] = 'This field is required.';
        if (!(g as any)?.guarantor_letter_url && !(g as any)?.intro_letter_url) newErrors[`g_guarantor_letter_${idx}`] = 'This field is required.';
        if (!(g as any)?.id_copy_url) newErrors[`g_id_copy_${idx}`] = 'This field is required.';
        if (!(g as any)?.residence_letter_url) newErrors[`g_residence_letter_${idx}`] = 'This field is required.';
        if (!g.phone || !isTZPhone(g.phone)) newErrors[`g_phone_${idx}`] = 'Please enter a valid Tanzanian phone number (e.g., 0755123456).';
      });
    }
    return newErrors;
  };

  const handleSave = async () => {
      try {
          const dataToSave = { ...formData };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave)); } catch {}
          (window as any).showNotification?.('success', 'Saved locally. Submit to create record.');
      } catch (e) {
          (window as any).showNotification?.('error', 'Failed to save changes.');
      }
  };

  const getStepErrors = (step: number): ValidationErrors => {
    if (isReadOnly) return {};
    const newErrors: ValidationErrors = {};
    if (step === 1) {
      if (!formData.full_name) newErrors.full_name = 'This field is required.';
      const nidErr = fieldError('nida_number', formData.nida_number);
      if (nidErr) newErrors.nida_number = nidErr;
      const phErr = fieldError('phone', formData.phone);
      if (phErr) newErrors.phone = phErr;
      if (!formData.dob) newErrors.dob = 'This field is required.';
      if (!formData.gender) newErrors.gender = 'This field is required.';
      if (formData.nssf_number && fieldError('nssf_number', formData.nssf_number)) newErrors.nssf_number = 'NSSF Number must contain digits only.';
      if (formData.bank_account_number && fieldError('bank_account_number', formData.bank_account_number)) newErrors.bank_account_number = 'Bank Account must be digits only.';
    }
    if (step === 2) {
      if (!formData.passport_photo_url) newErrors.passport_photo_url = 'This field is required.';
      if (!formData.nida_front_url) newErrors.nida_front_url = 'This field is required.';
      if (!formData.birth_cert_url) newErrors.birth_cert_url = 'This field is required.';
      if (!formData.application_letter_url) newErrors.application_letter_url = 'This field is required.';
      if (!formData.police_clearance_url) newErrors.police_clearance_url = 'This field is required.';
      if (!formData.cv_url) newErrors.cv_url = 'This field is required.';
      if (!formData.residence_letter_url) newErrors.residence_letter_url = 'This field is required.';
    }
    if (step === 3) {
      formData.education_records.forEach((e, idx) => {
        const s = (e as any)?.start_date;
        const en = (e as any)?.end_date;
        if (s && en) {
          if (new Date(en).getTime() < new Date(s).getTime()) {
            newErrors[`edu_end_${idx}`] = 'End date cannot be before start date.';
          }
        }
      });
    }
    if (step === 4) {
      if (!formData.next_of_kin_name) newErrors.next_of_kin_name = 'This field is required.';
      const kinPhErr = fieldError('next_of_kin_phone', formData.next_of_kin_phone);
      if (kinPhErr) newErrors.next_of_kin_phone = kinPhErr;
      if (!formData.next_of_kin_relationship) newErrors.next_of_kin_relationship = 'This field is required.';
      if (!formData.physical_address) newErrors.physical_address = 'This field is required.';
      if (!formData.emergency_contact) newErrors.emergency_contact = 'This field is required.';
      if (formData.guarantors.length < 2) {
        newErrors.guarantors = 'At least 2 guarantors are required';
      } else {
        formData.guarantors.forEach((g, idx) => {
          if (!g.name) newErrors[`g_name_${idx}`] = 'This field is required.';
          if (!g.relationship) newErrors[`g_rel_${idx}`] = 'This field is required.';
          if (!(g as any)?.guarantor_letter_url && !(g as any)?.intro_letter_url) newErrors[`g_guarantor_letter_${idx}`] = 'This field is required.';
          if (!(g as any)?.id_copy_url) newErrors[`g_id_copy_${idx}`] = 'This field is required.';
          if (!(g as any)?.residence_letter_url) newErrors[`g_residence_letter_${idx}`] = 'This field is required.';
          if (!g.phone || !isTZPhone(g.phone)) newErrors[`g_phone_${idx}`] = 'Please enter a valid Tanzanian phone number (e.g., 0755123456).';
        });
      }
    }
    return newErrors;
  };

  const validateStep = (step: number): boolean => {
    if (isReadOnly) return true;
    const newErrors = getStepErrors(step);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const proceed = () => {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    };
    if (isReadOnly) {
      proceed();
      return;
    }
    const newErrors = getStepErrors(currentStep);
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      proceed();
    } else {
      const firstKey = Object.keys(newErrors)[0];
      const el = document.getElementById(firstKey);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  // ------------------------------------------------------------------
  //  CORE LOGIC: THE SUBMIT FUNCTION
  // ------------------------------------------------------------------
  const handleSubmit = async () => {
      if (isReadOnly) {
        (window as any).showNotification?.('warning', 'Editing is locked. Please request HR unlock to submit changes.');
        return;
      }
      if (isSubmitting) return;
      const allErrors: ValidationErrors = getAllErrors();
      if (Object.keys(allErrors).length > 0) {
        setErrors(allErrors);
        const firstKey = Object.keys(allErrors)[0];
        const el = document.getElementById(firstKey) || (document.querySelector(`[name="${firstKey}"]`) as HTMLElement | null);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const friendly = (() => {
          // Map common keys to helpful Swahili messages
          if (allErrors['nida_front_url']) return 'Tafadhali pakia NIDA (mbele).';
          if (allErrors['cv_url']) return 'Tafadhali pakia CV yako.';
          if (allErrors['residence_letter_url']) return 'Tafadhali pakia Barua ya Mkazi (Serikali ya Mtaa).';
          const gKey = Object.keys(allErrors).find(k => k.startsWith('g_guarantor_letter_'));
          if (gKey) {
            const idx = Number(gKey.split('_').pop() || '0');
            return `Tafadhali pakia Barua ya Mdhamini (#${(idx || 0) + 1}).`;
          }
          const grKey = Object.keys(allErrors).find(k => k.startsWith('g_residence_letter_'));
          if (grKey) {
            const idx = Number(grKey.split('_').pop() || '0');
            return `Tafadhali pakia Barua ya Mkazi ya Mdhamini (#${(idx || 0) + 1}).`;
          }
          const idKey = Object.keys(allErrors).find(k => k.startsWith('g_id_copy_'));
          if (idKey) {
            const idx = Number(idKey.split('_').pop() || '0');
            return `Tafadhali pakia Nakala ya Kitambulisho cha Mdhamini (#${(idx || 0) + 1}).`;
          }
          return 'Tafadhali kamilisha taarifa zote zilizokosekana.';
        })();
        (window as any).showNotification?.('warning', friendly);
        try { console.warn('SUBMIT_BLOCKED', { errors: allErrors, message: friendly }); } catch {}
        return;
      }

      setIsSubmitting(true);
      try {

          // 1. Separate core guard data from related arrays (guarantors, education)
          // We must strip these arrays because 'guards' table doesn't have these columns.
          const { guarantors, education_records, ...coreGuardData } = formData;
          const eduForPayload = (Array.isArray(education_records) && education_records.length)
            ? education_records
            : (((formData as any).education_history || []) as any[]);

          const ecRaw = String(coreGuardData.emergency_contact || '').trim();
          const phoneMatch = ecRaw.match(/(\+?\d[\d\s\-]{6,})$/);
          const emergency_contact_phone = phoneMatch ? phoneMatch[1].trim() : undefined;
          const emergency_contact_name = ecRaw ? ecRaw.replace(phoneMatch?.[1] || '', '').replace(/[,\-]$/, '').trim() : undefined;
          const guardPayload = {
              ...coreGuardData,
              status: isApplicantFlow ? 'pending_approval' : (userRole === UserRole.SUPER_ADMIN ? 'marketplace' : 'interviewing'),
              profile_score: profileScore,
              gender: coreGuardData.gender || undefined,
              physical_address: coreGuardData.physical_address || undefined,
              emergency_contact: coreGuardData.emergency_contact || undefined,
              emergency_contact_name,
              emergency_contact_phone,
              previous_experience: coreGuardData.previous_experience || false,
              previous_employer_letter_url: coreGuardData.previous_employer_letter_url || undefined,
              kin_name: coreGuardData.next_of_kin_name || (initialData as any)?.kin_name || undefined,
              kin_phone: coreGuardData.next_of_kin_phone || (initialData as any)?.kin_phone || undefined,
              kin_relationship: coreGuardData.next_of_kin_relationship || (initialData as any)?.kin_relationship || undefined,
              dossier_data: { 
                ...(initialData as any)?.dossier_data, 
                intake_locked: true, 
                intake_submitted_at: new Date().toISOString(), 
                allow_edit: false,
                street: coreGuardData.street || (initialData as any)?.dossier_data?.street || '',
                ward: coreGuardData.ward || (initialData as any)?.dossier_data?.ward || '',
                district: coreGuardData.district || (initialData as any)?.dossier_data?.district || '',
                uniform_shirt_size: (coreGuardData as any).uniform_shirt_size || (initialData as any)?.dossier_data?.uniform_shirt_size || '',
                uniform_boot_size: (coreGuardData as any).uniform_boot_size || (initialData as any)?.dossier_data?.uniform_boot_size || '',
                shirt_size: (coreGuardData as any).uniform_shirt_size || (initialData as any)?.dossier_data?.shirt_size || '',
                boot_size: (coreGuardData as any).uniform_boot_size || (initialData as any)?.dossier_data?.boot_size || ''
              },
              security_training: (securityTraining.length ? securityTraining : undefined),
              ...((isApplicantFlow || userRole === UserRole.SUPER_ADMIN) ? { company_id: null } : {}),
              // Ensure we don't accidentally send undefined for ID if it's new
          };

          let savedGuard: Guard | undefined;
          let createdInOneShot = false;
          const hasTokenSubmit = !!(localStorage.getItem('amini_auth_token') || localStorage.getItem('token'));
          if (initialData?.id) {
            const patchUrl = hasTokenSubmit ? `/guards/${initialData.id}` : `/public/guards/${initialData.id}`;
            const payload = guardPayload;
            try { console.log("SENDING STATUS:", (payload as any)?.status); } catch {}
            const patchResult = await api.patch<Guard>(patchUrl, payload);
            if (patchResult.error || !patchResult.data) {
              console.warn(patchResult.error || 'guard update warning');
            }
            savedGuard = patchResult.data as unknown as Guard;
          } else {
            const createUrl = hasTokenSubmit ? '/guards' : '/public/guards';
            const payload: any = {
              ...guardPayload,
              education_records: (eduForPayload || []).map(e => ({
                institution_name: (e as any).institution_name || null,
                qualification_level: (e as any).qualification_level || e.level || null,
                completion_year: (e as any).completion_year || (e as any).year || (e as any).graduation_year || null,
                level: e.level,
                year: (e as any).year || (e as any).graduation_year || null,
                start_date: (e as any).start_date || null,
                end_date: (e as any).end_date || null,
                certificate_url: (e as any).certificate_url || null,
                weapon_proficiency: (e as any).weapon_proficiency || null
              })),
              guarantors: (guarantors || []).map(g => ({
                full_name: (g as any).name || (g as any).full_name || null,
                occupation: (g as any).occupation || null,
                phone: (g as any).phone || null,
                relationship: (g as any).relationship || null,
                id_copy_url: (g as any).id_copy_url || null,
                guarantor_letter_url: (g as any).guarantor_letter_url || (g as any).intro_letter_url || null,
                residence_letter_url: (g as any).residence_letter_url || null
              }))
            };
            try { console.log("SENDING STATUS:", (payload as any)?.status); } catch {}
            const createResult = await api.post<Guard>(createUrl, payload);
            if (createResult.error || !createResult.data) {
              console.warn(createResult.error || 'guard save warning');
            }
            savedGuard = createResult.data as unknown as Guard;
            createdInOneShot = true;
          }

          let upsertsOk = true;
          try {
            const gid = String(savedGuard?.id || initialData?.id || '');
            if (gid) {
              if (!createdInOneShot) {
                const eduLocal = (Array.isArray(formData.education_records) && formData.education_records.length)
                  ? formData.education_records
                  : (((formData as any).education_history || []) as any[]);
                const records = eduLocal.filter((e: any) => !!e.level || !!e.completion_year || !!e.year || !!e.certificate_url);
                if (records.length > 0) {
                  if (hasTokenSubmit) {
                    const res = await guardService.createEducationRecords(gid, records);
                    if (res.error) throw new Error(res.error);
                  } else {
      const payload = records.map(e => ({
                      institution_name: (e as any).institution_name || null,
                      level: (e as any).qualification_level || e.level,
                      graduation_year: (e as any).completion_year ? Number((e as any).completion_year) : (e as any).year ? Number((e as any).year) : null,
                      certificate_url: e.certificate_url || null
                    }));
                    const res = await api.post(`/guards/${gid}/education_records`, payload);
                    if (res.error) throw new Error(res.error as any);
                  }
                }
              }
              if (!createdInOneShot && Array.isArray(formData.guarantors)) {
                const guarantors = formData.guarantors.filter(g => !!g.name || !!g.phone || !!g.relationship || !!(g as any).intro_letter_url || !!(g as any).id_copy_url);
                if (guarantors.length > 0) {
                  if (hasTokenSubmit) {
                    const res = await guardService.createGuarantors(gid, guarantors);
                    if (res.error) throw new Error(res.error);
                  } else {
                    const payload = guarantors.map(g => ({
                      full_name: g.name,
                      occupation: (g as any)?.occupation || null,
                      phone: g.phone,
                      relationship: g.relationship,
                      id_copy_url: (g as any)?.id_copy_url || null,
                      guarantor_letter_url: (g as any)?.guarantor_letter_url || (g as any)?.intro_letter_url || null,
                      residence_letter_url: (g as any)?.residence_letter_url || null
                    }));
                    const res = await api.post(`/guards/${gid}/guarantors`, payload);
                    if (res.error) throw new Error(res.error as any);
                  }
                }
              }
            }
          } catch (e) {
            upsertsOk = false;
            (window as any).showNotification?.('error', 'Failed to save Education or Guarantors. Please try again.');
          }

          try {
            const idToRefresh = String(savedGuard?.id || initialData?.id || '');
            if (idToRefresh) {
              const res = await guardService.getGuardById(idToRefresh);
              if (res.data) {
                try { console.log('AFTER SUBMIT STATUS:', (res.data as any)?.status); } catch {}
                const wd = mapGuardToWizardData(res.data);
                setFormData(prev => safeMergeWizardData(prev, wd));
                setSecurityTraining(Array.isArray((res.data as any).security_training) ? (res.data as any).security_training : []);
              }
            }
          } catch {}

          // 5. Cleanup & Notify
          localStorage.removeItem(STORAGE_KEY);
          if (isApplicantFlow && upsertsOk) {
            (window as any).showNotification?.(
              'success',
              'Hongera! Usajili wako umepokelewa na System HR. Utapata taarifa hapa hapa kwenye Dashboard yako pindi utakapohakikiwa na kuwekwa kwenye Marketplace kwa ajili ya kuajiriwa na kampuni za ulinzi. Kaa tayari!'
            );
          }
          setHasSubmitted(true);
          
          await Promise.resolve(onComplete(savedGuard, isApplicantFlow));

          // Do not reset form; keep data visible for post-submit review

      } catch (error: any) {
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('unauthorized')) {
            (window as any).showNotification?.('warning', 'Please login to submit your application.');
            alert('Login required to submit. Open the login screen and try again.');
          } else if (msg.includes('forbidden')) {
            (window as any).showNotification?.('warning', 'Editing locked. Request HR unlock to resubmit.');
          } else {
            (window as any).showNotification?.('error', `Failed to submit application: ${error?.message || 'Unknown error'}`);
          }
      } finally {
          setIsSubmitting(false);
      }
  };

  const addEducation = () => {
      setFormData(prev => ({
          ...prev,
          education_records: [
              ...prev.education_records, 
              { id: `temp-${Date.now()}`, guard_id: '', level: 'secondary', institution_name: '', year: '', start_date: '', end_date: '', certificate_url: '' } as any
          ]
      }));
  };

  const updateEducation = (index: number, field: keyof EducationRecord, value: any) => {
      const updated = [...formData.education_records];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, education_records: updated }));
      if (field === 'start_date' || field === 'end_date') {
        const s = (updated[index] as any)?.start_date || '';
        const e = (updated[index] as any)?.end_date || '';
        const hasBoth = !!s && !!e;
        setErrors(prev => {
          const next = { ...prev };
          const key = `edu_end_${index}`;
          if (hasBoth && new Date(e).getTime() < new Date(s).getTime()) {
            next[key] = 'End date cannot be before start date.';
          } else {
            if (next[key]) delete next[key];
          }
          return next;
        });
      }
  };
  
  const removeEducation = (index: number) => {
      const updated = [...formData.education_records];
      updated.splice(index, 1);
      setFormData(prev => ({ ...prev, education_records: updated }));
  };

  

  
  const addGuarantor = () => {
      if (formData.guarantors.length >= 3) return;
      setFormData(prev => ({
          ...prev,
          guarantors: [
              ...prev.guarantors,
              { id: `temp-${Date.now()}`, guard_id: '', name: '', phone: '', relationship: '', occupation: '', guarantor_letter_url: '', id_copy_url: '', residence_letter_url: '' } as any
          ]
      }));
  };

  const updateGuarantor = (index: number, field: any, value: any) => {
      const updated = [...formData.guarantors];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, guarantors: updated }));
      const nameMap: Record<string, string> = {
        name: `g_name_${index}`,
        phone: `g_phone_${index}`,
        relationship: `g_rel_${index}`,
        guarantor_letter_url: `g_guarantor_letter_${index}`,
        id_copy_url: `g_id_copy_${index}`,
        residence_letter_url: `g_residence_letter_${index}`,
      };
      const key = nameMap[field as string];
      if (key) {
        setErrors(prev => {
          const next = { ...prev };
          const msg =
            field === 'phone'
              ? (!value ? 'This field is required.' : (isTZPhone(String(value)) ? undefined : 'Please enter a valid Tanzanian phone number (e.g., 0755123456).'))
              : (!value ? 'This field is required.' : undefined);
          if (msg) next[key] = msg;
          else delete next[key];
          return next;
        });
      }
  };
  
  const removeGuarantor = (index: number) => {
      const updated = [...formData.guarantors];
      updated.splice(index, 1);
      setFormData(prev => ({ ...prev, guarantors: updated }));
  };

  return (
    <form
      id="intakeForm"
      className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-500 relative overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        if (isLocked) return;
        handleSubmit();
      }}
    >
        <div className="space-y-16">
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="01" title="Identity & Contact" />
                      {isApplicantFlow && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                          <p className="text-[10px] font-black uppercase tracking-widest">
                            Company itapangwa na HR baadaye; company ID si lazima wakati wa intake.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Full Official Name" name="full_name" value={formData.full_name} onChange={handleChange} error={errors.full_name} placeholder="AS PER NIDA CARD" disabled={isReadOnly} />
                        <InputField
                          label="NIDA Number"
                          name="nida_number"
                          value={formData.nida_number}
                          onChange={handleChange}
                          error={errors.nida_number}
                          placeholder="19900101-..."
                          disabled={isReadOnly}
                        />
                        <InputField label="Mobile Phone" name="phone" value={formData.phone} onChange={handleChange} error={errors.phone} placeholder="+255..." disabled={isReadOnly} />
                        <InputField label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleChange} error={errors.dob} disabled={isReadOnly} />
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Gender</label>
                          <select
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            className="w-full h-14 px-4 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none focus:border-primary"
                            disabled={isReadOnly}
                          >
                            <option value="">Select Gender</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="trans">Trans Gender</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Security Training</label>
                          <div className="flex items-center gap-4 px-2">
                            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={securityTraining.includes('k9_handler')}
                                onChange={(e) => {
                                  const set = new Set(securityTraining);
                                  if (e.target.checked) set.add('k9_handler'); else set.delete('k9_handler');
                                  setSecurityTraining(Array.from(set));
                                }}
                                disabled={isReadOnly}
                              />
                              K-9 Handler 🐕
                            </label>
                            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={securityTraining.includes('fire_safety')}
                                onChange={(e) => {
                                  const set = new Set(securityTraining);
                                  if (e.target.checked) set.add('fire_safety'); else set.delete('fire_safety');
                                  setSecurityTraining(Array.from(set));
                                }}
                                disabled={isReadOnly}
                              />
                              Fire Safety 🔥
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Physical Address" name="physical_address" value={formData.physical_address || ''} onChange={handleChange} placeholder="Street, Ward, District" disabled={isReadOnly} />
                        <InputField label="Emergency Contact" name="emergency_contact" value={formData.emergency_contact || ''} onChange={handleChange} placeholder="Name & Phone" disabled={isReadOnly} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <InputField label="Street" name="street" value={formData.street || ''} onChange={handleChange} placeholder="Street" disabled={isReadOnly} />
                        <InputField label="Ward" name="ward" value={formData.ward || ''} onChange={handleChange} placeholder="Ward" disabled={isReadOnly} />
                        <InputField label="District" name="district" value={formData.district || ''} onChange={handleChange} placeholder="District" disabled={isReadOnly} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Uniform Shirt Size" name="uniform_shirt_size" value={formData.uniform_shirt_size || ''} onChange={handleChange} placeholder="S / M / L / XL" disabled={isReadOnly} />
                        <InputField label="Uniform Boot Size" name="uniform_boot_size" value={formData.uniform_boot_size || ''} onChange={handleChange} placeholder="EU 38-46" disabled={isReadOnly} />
                      </div>
                      <div className="pt-6 border-t border-slate-100">
                         <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-slate-50 transition-all">
                             <input type="checkbox" name="is_armed" checked={formData.is_armed} onChange={handleChange} className="w-6 h-6 rounded border-slate-300 text-primary focus:ring-primary" disabled={isReadOnly} />
                             <div>
                                 <span className="block text-sm font-black uppercase text-slate-800 tracking-wide">Armed Guard Certified</span>
                                 <span className="block text-xs text-slate-400 mt-1">Check this if you possess valid weapon handling certification</span>
                             </div>
                         </label>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Bank Account Number" name="bank_account_number" value={formData.bank_account_number || ''} onChange={handleChange} placeholder="1234-5678-..." disabled={isReadOnly} />
                        <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-slate-50 transition-all">
                          <input type="checkbox" name="previous_experience" checked={formData.previous_experience} onChange={handleChange} className="w-6 h-6 rounded border-slate-300 text-primary focus:ring-primary" disabled={isReadOnly} />
                          <div>
                            <span className="block text-sm font-black uppercase text-slate-800 tracking-wide">Previous Experience</span>
                            <span className="block text-xs text-slate-400 mt-1">Toggle on if previously employed; provide supporting documents</span>
                          </div>
                        </label>
                      </div>
                      {formData.previous_experience && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <InputField label="NSSF Number" name="nssf_number" value={formData.nssf_number || ''} onChange={handleChange} placeholder="NSSF-XXXX" disabled={isReadOnly} />
                          <FileUploader label="Letter from Previous Employer" fileUrl={formData.previous_employer_letter_url || ''} onUpload={(url) => handleFileChange('previous_employer_letter_url', url)} onRemove={() => handleFileChange('previous_employer_letter_url', '')} disabled={isReadOnly} />
                        </div>
                      )}
                  </div>
                    {(() => {
                      const coreDocs = [
                        formData.nida_front_url,
                        formData.birth_cert_url,
                        formData.application_letter_url,
                        formData.residence_letter_url,
                        formData.medical_report_url,
                        formData.police_clearance_url,
                        formData.cv_url,
                        formData.passport_photo_url
                      ];
                      const docsProvided = coreDocs.reduce((acc, v) => acc + (v && String(v).trim() !== '' ? 1 : 0), 0);
                      const docsTotal = coreDocs.length;
                      return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="02" title="Core Documentation" />
                      <div className="flex justify-end">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">Docs {docsProvided}/{docsTotal}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FileUploader label="NIDA ID Card (Front)" fileUrl={formData.nida_front_url} onUpload={(url) => handleFileChange('nida_front_url', url)} onRemove={() => handleFileChange('nida_front_url', '')} error={!!errors.nida_front_url} disabled={isReadOnly} />
                          <FileUploader label="Birth Certificate" fileUrl={formData.birth_cert_url} onUpload={(url) => handleFileChange('birth_cert_url', url)} onRemove={() => handleFileChange('birth_cert_url', '')} error={!!errors.birth_cert_url} disabled={isReadOnly} />
                          <FileUploader label="Handwritten Application Letter" fileUrl={formData.application_letter_url} onUpload={(url) => handleFileChange('application_letter_url', url)} onRemove={() => handleFileChange('application_letter_url', '')} error={!!errors.application_letter_url} disabled={isReadOnly} />
                          <FileUploader label="Local Govt Residence Letter" fileUrl={formData.residence_letter_url} onUpload={(url) => handleFileChange('residence_letter_url', url)} onRemove={() => handleFileChange('residence_letter_url', '')} disabled={isReadOnly} />
                          <FileUploader label="Medical Report" fileUrl={formData.medical_report_url || ''} onUpload={(url) => handleFileChange('medical_report_url', url)} onRemove={() => handleFileChange('medical_report_url', '')} disabled={isReadOnly} />
                          <FileUploader label="Police Clearance Certificate" fileUrl={formData.police_clearance_url} onUpload={(url) => handleFileChange('police_clearance_url', url)} onRemove={() => handleFileChange('police_clearance_url', '')} disabled={isReadOnly} />
                          <FileUploader label="Curriculum Vitae (CV)" fileUrl={formData.cv_url} onUpload={(url) => handleFileChange('cv_url', url)} onRemove={() => handleFileChange('cv_url', '')} disabled={isReadOnly} />
                          <FileUploader label="Passport Photo (Profile)" fileUrl={formData.passport_photo_url} onUpload={(url) => handleFileChange('passport_photo_url', url)} onRemove={() => handleFileChange('passport_photo_url', '')} disabled={isReadOnly} imagesOnly acceptTypes="image/jpeg,image/png" />
                      </div>
                  </div>
                      );
                    })()}
                   <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="03" title="Education History" />
                      <div className="space-y-6">
                        {formData.education_records.map((edu, index) => (
                            <div key={index} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative">
                                <button type="button" onClick={() => removeEducation(index)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Record #{index + 1}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                     <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Level</label>
                                        <select 
                                            value={edu.level} 
                                            onChange={(e) => updateEducation(index, 'level', e.target.value)}
                                            className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold text-xs uppercase outline-none"
                                            disabled={isReadOnly}
                                        >
                                            <option value="primary">Primary School</option>
                                            <option value="secondary">Secondary (O-Level)</option>
                                            <option value="advanced">Advanced (A-Level)</option>
                                            <option value="nta4_5">NTA Level 4/5</option>
                                            <option value="college">College</option>
                                            <option value="university">University</option>
                                            <option value="military">Military/JKT</option>
                                        </select>
                                     </div>
                                     <InputField label="Institution/School Name" name={`edu_institution_${index}`} value={(edu as any).institution_name || ''} onChange={(e) => updateEducation(index, 'institution_name', e.target.value)} placeholder="Enter institution name" disabled={isReadOnly} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                     <InputField 
                                        label="Start Date" 
                                        name={`edu_start_${index}`} 
                                        value={(edu as any).start_date || ''} 
                                        onChange={(e) => updateEducation(index, 'start_date' as any, (e.target as HTMLInputElement).value)} 
                                        type="date" 
                                        placeholder="YYYY-MM-DD" 
                                        disabled={isReadOnly} 
                                     />
                                     <InputField 
                                        label="End Date" 
                                        name={`edu_end_${index}`} 
                                        value={(edu as any).end_date || ''} 
                                        onChange={(e) => updateEducation(index, 'end_date' as any, (e.target as HTMLInputElement).value)} 
                                        error={errors[`edu_end_${index}`]}
                                        type="date" 
                                        placeholder="YYYY-MM-DD" 
                                        disabled={isReadOnly} 
                                     />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                     <InputField label="Completion Year" name={`edu_year_${index}`} value={edu.year} onChange={(e) => updateEducation(index, 'year', e.target.value.replace(/[^0-9]/g, '').slice(0,4))} placeholder="YYYY" disabled={isReadOnly} />
                                </div>
                                <FileUploader label="Certificate Scan" fileUrl={edu.certificate_url} onUpload={(url) => updateEducation(index, 'certificate_url', url)} onRemove={() => updateEducation(index, 'certificate_url', '')} className="h-28" disabled={isReadOnly} />
                            </div>
                        ))}
                        <button type="button" onClick={addEducation} className="w-full py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all" disabled={isReadOnly}>
                            + Add Qualification
                        </button>
                      </div>

                      <SectionHeader number="04" title="Next of Kin & Guarantors" />
                      <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100">
                         <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-4">Next of Kin (Emergency)</h4>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <InputField label="Full Name" name="next_of_kin_name" value={formData.next_of_kin_name} onChange={handleChange} error={errors.next_of_kin_name} />
                            <InputField label="Phone" name="next_of_kin_phone" value={formData.next_of_kin_phone} onChange={handleChange} error={errors.next_of_kin_phone} disabled={isReadOnly} />
                            <InputField label="Relationship" name="next_of_kin_relationship" value={formData.next_of_kin_relationship} onChange={handleChange} error={errors.next_of_kin_relationship} disabled={isReadOnly} />
                         </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-black uppercase tracking-tight text-slate-900">Guarantors ({formData.guarantors.length}/3)</h4>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">MINIMUM 2 REQUIRED</span>
                        </div>
                        {errors.guarantors && <p className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{errors.guarantors}</p>}
                        
                        {formData.guarantors.map((g, index) => (
                             <div key={index} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative">
                                <button type="button" onClick={() => removeGuarantor(index)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors" disabled={isReadOnly}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Guarantor #{index + 1}</h4>
                                {errors[`guarantor_${index}`] && <p className="text-[10px] font-bold text-red-500 mb-2">Incomplete Details</p>}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <InputField label="Full Name" name={`g_name_${index}`} value={g.name} onChange={(e) => updateGuarantor(index, 'name', e.target.value)} error={errors[`g_name_${index}`]} disabled={isReadOnly} />
                                    <InputField label="Occupation / Kazi" name={`g_occ_${index}`} value={(g as any).occupation || ''} onChange={(e) => updateGuarantor(index, 'occupation', e.target.value)} disabled={isReadOnly} />
                                    <InputField label="Phone" name={`g_phone_${index}`} value={g.phone} onChange={(e) => updateGuarantor(index, 'phone', e.target.value)} error={errors[`g_phone_${index}`]} disabled={isReadOnly} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <InputField label="Relationship" name={`g_rel_${index}`} value={g.relationship} onChange={(e) => updateGuarantor(index, 'relationship', e.target.value)} error={errors[`g_rel_${index}`]} disabled={isReadOnly} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FileUploader label="Guarantor Letter" fileUrl={(g as any)?.guarantor_letter_url || (g as any)?.intro_letter_url || ''} onUpload={(url) => updateGuarantor(index, 'guarantor_letter_url', url)} onRemove={() => updateGuarantor(index, 'guarantor_letter_url', '')} className="h-24" disabled={isReadOnly} />
                                    <FileUploader label="ID Copy" fileUrl={(g as any)?.id_copy_url || ''} onUpload={(url) => updateGuarantor(index, 'id_copy_url', url)} onRemove={() => updateGuarantor(index, 'id_copy_url', '')} className="h-24" disabled={isReadOnly} />
                                    <FileUploader label="Residence Letter (Serikali ya Mtaa)" fileUrl={(g as any)?.residence_letter_url || ''} onUpload={(url) => updateGuarantor(index, 'residence_letter_url', url)} onRemove={() => updateGuarantor(index, 'residence_letter_url', '')} className="h-24" disabled={isReadOnly} />
                                </div>
                            </div>
                        ))}
                         <button type="button" onClick={addGuarantor} className="w-full py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all" disabled={isReadOnly}>
                            + Add Guarantor
                        </button>
                      </div>
                   </div>
        </div>

        <div className="flex gap-4 mt-12 pt-8 border-t border-slate-100">
            <button
                type="button"
                onClick={() => {
                  setFormData({
                    full_name: '',
                    nida_number: '',
                    phone: '',
                    dob: '',
                    gender: '',
                    application_letter_url: '',
                    nida_front_url: '',
                    birth_cert_url: '',
                    medical_report_url: '',
                    police_clearance_url: '',
                    cv_url: '',
                    passport_photo_url: '',
                    guarantors: [],
                    next_of_kin_name: '',
                    next_of_kin_phone: '',
                    next_of_kin_relationship: '',
                    residence_letter_url: '',
                    education_records: [],
                    is_armed: false,
                    residence_lat: undefined,
                    residence_lng: undefined,
                    bank_account_number: '',
                    previous_experience: false,
                    nssf_number: '',
                    previous_employer_letter_url: '',
                    physical_address: '',
                    street: '',
                    ward: '',
                    district: '',
                    emergency_contact: '',
                    uniform_shirt_size: '',
                    uniform_boot_size: ''
                  } as any);
                  setErrors({});
                  try { localStorage.removeItem(STORAGE_KEY); } catch {}
                  (window as any).showNotification?.('success', 'Form cleared');
                }}
                className="px-8 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                disabled={isLocked}
            >
                Clear
            </button>
            <button
                type="button"
                onClick={handleSave}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all"
                disabled={isLocked}
            >
                Save
            </button>
            {isLocked ? (
              <div className="flex-grow py-4 bg-slate-50 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-2xl border border-slate-200 text-center">
                Maombi yako yameshatumwa na yanahakikiwa.
              </div>
            ) : (
              <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isLocked || isSubmitting}
                  className="relative group flex-grow py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:from-primary hover:via-primary-dark hover:to-primary-light transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                  {isSubmitting ? (
                      <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                      </>
                  ) : (
                      <>
                          Submit Application
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-active:opacity-20 bg-primary transition-opacity duration-150 pointer-events-none"></div>
                      </>
                  )}
              </button>
            )}
        </div>
       
    </form>
  );

};
