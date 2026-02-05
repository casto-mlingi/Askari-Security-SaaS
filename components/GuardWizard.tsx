import React, { useState, useEffect } from 'react';
import { EducationRecord, Guard, ApplicationStatus, UserRole, Guarantor } from '../types';
import FileUploader from './FileUploader';
import { guardService } from '../services/guardService';
import { supabase } from '../services/supabaseClient';

interface WizardData {
  full_name: string;
  nida_number: string;
  phone: string;
  dob: string;
  application_letter_url: string;
  nida_front_url: string;
  birth_cert_url: string;
  guarantors: Guarantor[];
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
  residence_lat?: number;
  residence_lng?: number;
  residence_letter_url: string;
  education_history: EducationRecord[];
  is_armed: boolean;
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
}> = ({ label, name, value, onChange, error, type = 'text', placeholder, className, rightElement }) => (
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
            className={`w-full h-14 px-6 bg-slate-50 border-2 rounded-xl font-bold text-sm outline-none transition-all ${error ? 'border-red-300' : 'border-slate-100 focus:border-primary'}`}
        />
        {error && <p className="text-xs font-medium text-red-500 mt-1 ml-2">{error}</p>}
    </div>
);

const STORAGE_KEY_PREFIX = 'amini_guard_wizard_draft_';

export const GuardWizard: React.FC<{ guards: Guard[], userRole: UserRole, initialData?: Partial<Guard>, onComplete: (guard: Guard, isApplicantFlow?: boolean) => void, isApplicantFlow?: boolean }> = ({ initialData, onComplete, isApplicantFlow = false }) => {
  const STORAGE_KEY = initialData?.id ? `${STORAGE_KEY_PREFIX}${initialData.id}` : STORAGE_KEY_PREFIX + 'new';
  
  const initialFormState: WizardData = {
    full_name: initialData?.full_name || '',
    nida_number: initialData?.nida_number || '',
    phone: initialData?.phone || '',
    dob: initialData?.dob || '',
    application_letter_url: initialData?.application_letter_url || '',
    nida_front_url: initialData?.nida_front_url || '',
    birth_cert_url: initialData?.birth_cert_url || '',
    guarantors: initialData?.guarantors || [],
    next_of_kin_name: initialData?.next_of_kin_name || '',
    next_of_kin_phone: initialData?.next_of_kin_phone || '',
    next_of_kin_relationship: initialData?.next_of_kin_relationship || '',
    residence_letter_url: initialData?.residence_letter_url || '',
    education_history: initialData?.education_history || [],
    is_armed: initialData?.is_armed || false,
    residence_lat: initialData?.residence_lat,
    residence_lng: initialData?.residence_lng,
  };

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<WizardData>(initialFormState);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load draft from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && !initialData) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, [STORAGE_KEY, initialData]);

  // Auto-extract DOB from NIDA number
  useEffect(() => {
    const cleanNida = formData.nida_number.replace(/[^0-9]/g, '');
    if (cleanNida.length >= 8) {
      const yyyy = parseInt(cleanNida.substring(0, 4));
      const mm = parseInt(cleanNida.substring(4, 6));
      const dd = parseInt(cleanNida.substring(6, 8));

      if (yyyy > 1900 && yyyy < new Date().getFullYear() && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
          const formattedDob = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
          if (formData.dob !== formattedDob) {
              setFormData(prev => ({ ...prev, dob: formattedDob }));
              setErrors(prev => { const newErrors = { ...prev }; delete newErrors.dob; return newErrors; });
          }
      }
    }
  }, [formData.nida_number]);

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
                dataToSave.education_history = dataToSave.education_history.map(e => ({
                    ...e, certificate_url: isHeavy(e.certificate_url) ? '' : e.certificate_url
                }));
                dataToSave.guarantors = dataToSave.guarantors.map(g => ({
                    ...g, letter_url: isHeavy(g.letter_url) ? '' : g.letter_url, residence_letter_url: isHeavy(g.residence_letter_url) ? '' : g.residence_letter_url
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
    if (errors[name]) {
      setErrors(prev => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
    }
  };

  const handleFileChange = (field: keyof WizardData, url: string) => {
    setFormData(prev => ({ ...prev, [field]: url }));
    if (errors[field as string]) {
      setErrors(prev => { const newErrors = { ...prev }; delete newErrors[field as string]; return newErrors; });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    if (step === 1) {
      if (!formData.full_name) newErrors.full_name = 'Required';
      if (!formData.nida_number) newErrors.nida_number = 'Required';
      if (!formData.phone) newErrors.phone = 'Required';
      if (!formData.dob) newErrors.dob = 'Required';
    }

    if (step === 2) {
      if (!formData.nida_front_url) newErrors.nida_front_url = 'NIDA ID document is mandatory';
      if (!formData.birth_cert_url) newErrors.birth_cert_url = 'Birth Certificate is mandatory';
      if (!formData.application_letter_url) newErrors.application_letter_url = 'Application Letter is mandatory';
    }

    if (step === 4) {
        if (!formData.next_of_kin_name) newErrors.next_of_kin_name = 'Required';
        if (!formData.next_of_kin_phone) newErrors.next_of_kin_phone = 'Required';
        if (!formData.next_of_kin_relationship) newErrors.next_of_kin_relationship = 'Required';
        
        if (formData.guarantors.length < 2) {
             newErrors.guarantors = 'At least 2 guarantors are required';
        } else {
             formData.guarantors.forEach((g, idx) => {
                 if(!g.name || !g.phone || !g.relationship || !g.letter_url || !g.residence_letter_url) {
                      newErrors[`guarantor_${idx}`] = 'Incomplete guarantor details';
                 }
             });
        }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      isValid = false;
    }

    return isValid;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
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
      if (!validateStep(currentStep)) return;

      setIsSubmitting(true);
      try {
          // 1. Separate core guard data from related arrays (guarantors, education)
          // We must strip these arrays because 'guards' table doesn't have these columns.
          const { guarantors, education_history, ...coreGuardData } = formData;

          const guardPayload = {
              ...coreGuardData,
              application_status: initialData?.application_status || ApplicationStatus.POOL_APPLICANT,
              profile_score: 50, // This could be calculated dynamically
              // Ensure we don't accidentally send undefined for ID if it's new
          };

          let guardId = initialData?.id;

          // 2. Insert or Update the Core Guard Record
          if (guardId) {
              // Edit Mode
              await guardService.updateGuard(guardId, guardPayload);
          } else {
              // Create Mode
              const { data, error } = await guardService.createGuard(guardPayload);
              if (error || !data) throw new Error(error || 'Failed to create guard record');
              guardId = data.id;
          }

          if (!guardId) throw new Error("Guard ID is missing after creation.");

          // 3. Insert Guarantors using service method
          if (guarantors.length > 0) {
              const guarantorResult = await guardService.createGuarantors(guardId, guarantors);
              if (guarantorResult.error) {
                  console.error("Guarantor insert error:", guarantorResult.error);
                  // Optional: Could throw error or show warning
              }
          }

          // 4. Insert Education Records using service method
          if (education_history.length > 0) {
              const educationResult = await guardService.createEducationRecords(guardId, education_history);
              if (educationResult.error) {
                  console.error("Education insert error:", educationResult.error);
              }
          }

          // 5. Cleanup & Notify
          localStorage.removeItem(STORAGE_KEY);
          
          // Fetch the FULL object (with relations) to pass back to the parent component
          const { data: completeGuard } = await guardService.getGuardById(guardId);
          
          if (completeGuard) {
              onComplete(completeGuard, isApplicantFlow);
          } else {
              // Fallback if fetch fails
              onComplete({ id: guardId, ...formData, application_status: ApplicationStatus.POOL_APPLICANT } as Guard, isApplicantFlow);
          }

          // Reset Form
          setFormData(initialFormState);
          setCurrentStep(1);
          setErrors({});

      } catch (error: any) {
          console.error('Submission error:', error);
          alert(`Failed to submit application: ${error.message || 'Unknown error'}`);
      } finally {
          setIsSubmitting(false);
      }
  };

  const addEducation = () => {
      setFormData(prev => ({
          ...prev,
          education_history: [
              ...prev.education_history, 
              { id: `temp-${Date.now()}`, guard_id: '', level: 'secondary', year: '', certificate_url: '' }
          ]
      }));
  };

  const updateEducation = (index: number, field: keyof EducationRecord, value: any) => {
      const updated = [...formData.education_history];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, education_history: updated }));
  };
  
  const removeEducation = (index: number) => {
      const updated = [...formData.education_history];
      updated.splice(index, 1);
      setFormData(prev => ({ ...prev, education_history: updated }));
  };

  const addGuarantor = () => {
      if (formData.guarantors.length >= 3) return;
      setFormData(prev => ({
          ...prev,
          guarantors: [
              ...prev.guarantors,
              { id: `temp-${Date.now()}`, guard_id: '', name: '', phone: '', relationship: '', letter_url: '', residence_letter_url: '' }
          ]
      }));
  };

  const updateGuarantor = (index: number, field: keyof Guarantor, value: any) => {
      const updated = [...formData.guarantors];
      updated[index] = { ...updated[index], [field]: value };
      setFormData(prev => ({ ...prev, guarantors: updated }));
      if (errors[`guarantor_${index}`]) {
          setErrors(prev => { const newErrors = { ...prev }; delete newErrors[`guarantor_${index}`]; return newErrors; });
      }
  };
  
  const removeGuarantor = (index: number) => {
      const updated = [...formData.guarantors];
      updated.splice(index, 1);
      setFormData(prev => ({ ...prev, guarantors: updated }));
  };

  // Render Steps
  const renderStep = () => {
      switch (currentStep) {
          case 1:
              return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="01" title="Identity & Contact" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField label="Full Official Name" name="full_name" value={formData.full_name} onChange={handleChange} error={errors.full_name} placeholder="AS PER NIDA CARD" />
                        <InputField label="NIDA Number" name="nida_number" value={formData.nida_number} onChange={handleChange} error={errors.nida_number} placeholder="19900101-..." />
                        <InputField label="Mobile Phone" name="phone" value={formData.phone} onChange={handleChange} error={errors.phone} placeholder="+255..." />
                        <InputField label="Date of Birth" name="dob" type="date" value={formData.dob} onChange={handleChange} error={errors.dob} />
                      </div>
                      
                      <div className="pt-6 border-t border-slate-100">
                         <label className="flex items-center gap-4 cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-slate-50 transition-all">
                             <input type="checkbox" name="is_armed" checked={formData.is_armed} onChange={handleChange} className="w-6 h-6 rounded border-slate-300 text-primary focus:ring-primary" />
                             <div>
                                 <span className="block text-sm font-black uppercase text-slate-800 tracking-wide">Armed Guard Certified</span>
                                 <span className="block text-xs text-slate-400 mt-1">Check this if you possess valid weapon handling certification</span>
                             </div>
                         </label>
                      </div>
                  </div>
              );
          case 2:
              return (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="02" title="Core Documentation" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FileUploader label="NIDA ID Card (Front)" fileUrl={formData.nida_front_url} onUpload={(url) => handleFileChange('nida_front_url', url)} onRemove={() => handleFileChange('nida_front_url', '')} error={!!errors.nida_front_url} />
                          <FileUploader label="Birth Certificate" fileUrl={formData.birth_cert_url} onUpload={(url) => handleFileChange('birth_cert_url', url)} onRemove={() => handleFileChange('birth_cert_url', '')} error={!!errors.birth_cert_url} />
                          <FileUploader label="Handwritten Application Letter" fileUrl={formData.application_letter_url} onUpload={(url) => handleFileChange('application_letter_url', url)} onRemove={() => handleFileChange('application_letter_url', '')} error={!!errors.application_letter_url} />
                          <FileUploader label="Local Govt Residence Letter" fileUrl={formData.residence_letter_url} onUpload={(url) => handleFileChange('residence_letter_url', url)} onRemove={() => handleFileChange('residence_letter_url', '')} />
                      </div>
                  </div>
              );
          case 3:
              return (
                   <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="03" title="Education History" />
                      <div className="space-y-6">
                        {formData.education_history.map((edu, index) => (
                            <div key={index} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative">
                                <button onClick={() => removeEducation(index)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">
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
                                        >
                                            <option value="primary">Primary School</option>
                                            <option value="secondary">Secondary (O-Level)</option>
                                            <option value="advanced">Advanced (A-Level)</option>
                                            <option value="nta4_5">NTA Level 4/5</option>
                                            <option value="military">Military/JKT</option>
                                        </select>
                                     </div>
                                     <InputField label="Completion Year" name={`edu_year_${index}`} value={edu.year} onChange={(e) => updateEducation(index, 'year', e.target.value)} placeholder="YYYY" />
                                </div>
                                <FileUploader label="Certificate Scan" fileUrl={edu.certificate_url} onUpload={(url) => updateEducation(index, 'certificate_url', url)} onRemove={() => updateEducation(index, 'certificate_url', '')} className="h-28" />
                            </div>
                        ))}
                        <button onClick={addEducation} className="w-full py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all">
                            + Add Qualification
                        </button>
                      </div>
                   </div>
              );
          case 4:
               return (
                   <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                      <SectionHeader number="04" title="Guarantors & Next of Kin" />
                      
                      <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 mb-8">
                         <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-4">Next of Kin (Emergency)</h4>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <InputField label="Full Name" name="next_of_kin_name" value={formData.next_of_kin_name} onChange={handleChange} error={errors.next_of_kin_name} />
                             <InputField label="Phone" name="next_of_kin_phone" value={formData.next_of_kin_phone} onChange={handleChange} error={errors.next_of_kin_phone} />
                             <InputField label="Relationship" name="next_of_kin_relationship" value={formData.next_of_kin_relationship} onChange={handleChange} error={errors.next_of_kin_relationship} />
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
                                <button onClick={() => removeGuarantor(index)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </button>
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Guarantor #{index + 1}</h4>
                                {errors[`guarantor_${index}`] && <p className="text-[10px] font-bold text-red-500 mb-2">Incomplete Details</p>}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                     <InputField label="Full Name" name={`g_name_${index}`} value={g.name} onChange={(e) => updateGuarantor(index, 'name', e.target.value)} />
                                     <InputField label="Phone" name={`g_phone_${index}`} value={g.phone} onChange={(e) => updateGuarantor(index, 'phone', e.target.value)} />
                                     <InputField label="Relationship" name={`g_rel_${index}`} value={g.relationship} onChange={(e) => updateGuarantor(index, 'relationship', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FileUploader label="Intro Letter" fileUrl={g.letter_url} onUpload={(url) => updateGuarantor(index, 'letter_url', url)} onRemove={() => updateGuarantor(index, 'letter_url', '')} className="h-24" />
                                    <FileUploader label="Residence ID/Letter" fileUrl={g.residence_letter_url} onUpload={(url) => updateGuarantor(index, 'residence_letter_url', url)} onRemove={() => updateGuarantor(index, 'residence_letter_url', '')} className="h-24" />
                                </div>
                            </div>
                        ))}
                         <button onClick={addGuarantor} className="w-full py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 border-2 border-dashed border-slate-300 hover:border-slate-400 transition-all">
                            + Add Guarantor
                        </button>
                      </div>
                   </div>
               );
          default:
              return null;
      }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-500 relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
            <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(currentStep / 4) * 100}%` }} />
        </div>

        <div className="mb-10 flex justify-between items-end">
            <div>
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Step {currentStep} of 4</span>
                 <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mt-2 leading-none">
                     {currentStep === 1 ? 'Personal Info' : 
                      currentStep === 2 ? 'Documents' : 
                      currentStep === 3 ? 'Education' : 'Guarantors'}
                 </h2>
            </div>
        </div>
        
        {renderStep()}

        <div className="flex gap-4 mt-12 pt-8 border-t border-slate-100">
            {currentStep > 1 && (
                <button onClick={handleBack} className="px-8 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all">
                    Back
                </button>
            )}
            <button
                onClick={currentStep === 4 ? handleSubmit : handleNext}
                disabled={isSubmitting}
                className="flex-grow py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-primary transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait"
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
                        {currentStep === 4 ? 'Submit Application' : 'Next Step'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </>
                )}
            </button>
        </div>
    </div>
  );
};